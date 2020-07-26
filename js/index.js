const MAX_ATTEMPTS = 10;

class QuoteCache {
    constructor() {
        this.loadHistory();
        this.pointToEnd();
    }

    createLog(nq) {
        this.history.push({
            date: Date.now(),
            quoteText: nq.quoteText,
            quoteAuthor: nq.quoteAuthor
        });

        this.saveHistory();
    }

    prev() {
        if (this.pointer === 0) {
            return this;
        }
        --this.pointer;
        return this;
    }

    next() {
        if (this.pointer >= this.history.length - 1) {
            return this;
        }
        ++this.pointer;
        return this;
    }

    get() {
        return this.history[this.pointer];
    }

    pointToEnd() {
        this.pointer = this.history.length - 1;
    }

    isAtEnd() {
        return this.pointer >= this.history.length - 1;
    }

    saveHistory() {
        localStorage.setItem('quote-gen-history', JSON.stringify(this.history));
    }

    loadHistory() {
        this.history = JSON.parse(localStorage.getItem('quote-gen-history')) || [];
    }

    clearHistory() {
        localStorage.removeItem('quote-gen-history');
    }

    printHistory() {
        this.history.forEach(log => console.log(log))
    }
}

const createLog = () => {
    let n = 0;
    return (msg) => {
        if (msg instanceof Error) {
            console.error(`${new Date().toISOString()}-LOG-#${++n} => ${msg}`);
            return false;
        }
        console.log(`${new Date().toISOString()}-LOG-#${++n} => ${msg}`);
        return true;
    }
}

const timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const sleep = async (ms) => await Promise.all([timeout(ms / 2)], [timeout(ms / 2)]);

const getQuote = async () => {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const apiUrl = 'http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en';

    try {
        const res = await fetch(proxyUrl + apiUrl);
        return await res.json();
    } catch (err) {
        return log(err);
    }
}

const quoteLimiter = async (_, n = 1) => {
    log(`Trying API: ${n}`);
    let data = await getQuote();

    if (!data) {
        const delay = 50;

        if (n < MAX_ATTEMPTS) {
            log(`Retrying API in ${delay}ms`);
            sleep(delay);
            return await quoteLimiter(null, ++n);
        }
    }

    return { data, n };
}

const reactiveDOM = (shadowDOM) => {
    let data = null;
    let n = 0;

    const updateUI = async (nq) => {
        try {
            shadowDOM.authorText.innerHTML = nq.quoteAuthor;
            shadowDOM.quoteText.innerHTML = nq.quoteText;
        } catch (err) {
            log(err);
            return { success: false, error: err };
        }

        return { success: true, error: null };
    }

    const tryGetQuote = async (_, missingDataTryCount = 1) => {
        let { data, n } = await quoteLimiter(null, missingDataTryCount);

        if (data) {
            if (n <= MAX_ATTEMPTS) {
                const { success, error } = await updateUI(data);

                if (!success) {
                    log(`API response had missing data (${error}). Trying again.`);
                    if (n < MAX_ATTEMPTS) {
                        return await tryGetQuote(null, ++missingDataTryCount)
                    }
                    
                    throw Error(`Unable to update UI successfully from API: ${error}`);
                }

                cache.createLog(data);
                return log(`UI updated successfully after ${n} attempt${n == 1 ? '' : 's'}`);
            }        
        }

        if (!data && n >= MAX_ATTEMPTS) {
            throw new Error(`Unable to retrieve quote from API after ${n} attempt${n == 1 ? '' : 's'}`);
        }
    }

    shadowDOM.getQuoteBtn.addEventListener('click', tryGetQuote.bind(null));

    return {
        exec: tryGetQuote.bind(null)
    }
}

const initQuoteDOM = () => {
    return {
        quoteText: document.getElementById('quote'),
        authorText: document.getElementById('author'),
        getQuoteBtn: document.getElementById('new-quote')
    }
}

const initStoreDOM = () => {
    return {
        favContainer: document.getElementById('fav-container'),
        favTitleBox: document.getElementById('fav-title-text'),
        favsList: document.getElementById('favs-list'),
        saveBtn: document.getElementById('save-quote'),
        prevBtn: document.getElementById('prev'),
        stopBtn: document.getElementById('stop'),
        playBtn: document.getElementById('play'),
        nextBtn: document.getElementById('next'),
        twitterTab: document.getElementById('twitter-tablet'),
        twitterMob: document.getElementById('twitter-mobile')
    };
}

const log = createLog();
const quoteMachine = reactiveDOM(initQuoteDOM());
const cache = new QuoteCache();
const dom = initStoreDOM();
const quoteDom = initQuoteDOM();

let playInterval = null;

cache.loadHistory();

console.log(cache);

const prevHandler = () => {
    const prevQuote = cache.prev().get();
    quoteDom.quoteText.innerHTML = prevQuote.quoteText;
    quoteDom.authorText.innerHTML = prevQuote.quoteAuthor;
};

const nextHandler = () => {
    if (cache.isAtEnd()) {
        clearInterval(playInterval);
        playInterval = null;
    }

    const nextQuote = cache.next().get();
    console.log(nextQuote)
    quoteDom.quoteText.innerHTML = nextQuote.quoteText;
    quoteDom.authorText.innerHTML = nextQuote.quoteAuthor;
}

dom.prevBtn.addEventListener('click', prevHandler);
dom.stopBtn.addEventListener('click', clearInterval(playInterval));
dom.playBtn.addEventListener('click', () => playInterval = setInterval(nextHandler, 4500));
dom.nextBtn.addEventListener('click', nextHandler);

const twitterHandler = () => {

}

dom.twitterTab.addEventListener('click', twitterHandler);
dom.twitterMob.addEventListener('click', twitterHandler);



