/**
 * State
 */

/**
 * Actions
 */

/**
 * Mutations
 */

/**
 * Store
 */

/**
 * Pub/Sub
 */

/**
 * Base Component
 */

/**
 * UI Components
 */

/**
 * Utils
 */

/**
 * Init
 */



const MAX_ATTEMPTS = 10;
const PRE_FAB_QUOTE = {
    quoteText: 'Look with favour upon a bold beginning.',
    quoteAuthor: 'Virgil'
};

class QuoteCache {
    constructor() {
        this.loadHistory();
        this.loadSavedQuotes();
        this.pointToEnd();
    }

    createLog(nq) {
        this.history.push({
            date: Date.now(),
            quoteText: nq.quoteText,
            quoteAuthor: nq.quoteAuthor
        });

        this.saveHistory();
        this.pointToEnd();
    }

    createFavourite() {
        const fav = this.get();

        this.savedQuotes.push({
            date: fav.date,
            quoteText: fav.quoteText,
            quoteAuthor: fav.quoteAuthor
        });

        this.persistSavedQuotes();
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

    getPointer() {
        return this.pointer;
    }

    getLength() {
        return this.history.length;
    }

    getLast() {
        return this.history[this.history.length - 1] || null;
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

    persistSavedQuotes() {
        localStorage.setItem('quote-gen-saved', JSON.stringify(this.savedQuotes));
    }

    loadSavedQuotes() {
        this.savedQuotes = JSON.parse(localStorage.getItem('quote-gen-saved')) || [];
    }

    clearHistory() {
        localStorage.removeItem('quote-gen-history');
    }

    clearSavedQuotes() {
        localStorage.removeItem('quote-gen-saved');
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

const apiHook = (shadowDOM) => {

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
                trackerHandler();
                return log(`UI updated successfully after ${n} attempt${n == 1 ? '' : 's'}`);
            }        
        }

        if (!data && n >= MAX_ATTEMPTS) {
            throw new Error(`Unable to retrieve quote from API after ${n} attempt${n == 1 ? '' : 's'}`);
        }
    }

    shadowDOM.getQuoteBtn.addEventListener('click', tryGetQuote.bind(null));

    return {
        updateUI,
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
        twitterMob: document.getElementById('twitter-mobile'),
        nominator: document.getElementById('nominator'),
        denominator: document.getElementById('denominator'),
    };
}

const log = createLog();
const quoteMachine = apiHook(initQuoteDOM());
const cache = new QuoteCache();
const dom = initStoreDOM();
const quoteDom = initQuoteDOM();

let playInterval = null;

const trackerHandler = () => {
    dom.nominator.innerHTML = cache.getPointer() + 1;
    dom.denominator.innerHTML = cache.getLength();
};

trackerHandler();

const prevHandler = () => {
    const prevQuote = cache.prev().get();
    quoteDom.quoteText.innerHTML = prevQuote.quoteText;
    quoteDom.authorText.innerHTML = prevQuote.quoteAuthor;
    trackerHandler();
};

const nextHandler = () => {
    if (cache.isAtEnd()) {
        clearInterval(playInterval);
        playInterval = null;
        return;
    }

    const nextQuote = cache.next().get();
    quoteDom.quoteText.innerHTML = nextQuote.quoteText;
    quoteDom.authorText.innerHTML = nextQuote.quoteAuthor;
    trackerHandler();
};

const saveHander = () => {

    cache.createFavourite();
    savedQuotePrintHandler();
};

const savedQuotePrintHandler = () => {
    const createItemHtml = (q) => {
        let str = `<li class="favs-list-item">`;
        str += `${q.quoteText}`;
        str += `<span class="favs-list-author">${q.quoteAuthor}</span>`;
        str += `<i class="fas fa-times"></i>`;
        str += `</li>`;

        return str;
    }

    // cache.savedQuotes.forEach(quote => {
    //     dom.favsList.innerHTML += createItemHtml(quote)
    // });

    dom.favsList.innerHTML = cache.savedQuotes.map(quote => createItemHtml(quote)).join('');
};

const twitterHandler = () => {

};

dom.prevBtn.addEventListener('click', prevHandler);
dom.stopBtn.addEventListener('click', clearInterval(playInterval));
dom.playBtn.addEventListener('click', () => playInterval = setInterval(nextHandler, 4500));
dom.nextBtn.addEventListener('click', nextHandler);
dom.saveBtn.addEventListener('click', saveHander);
dom.twitterTab.addEventListener('click', twitterHandler);
dom.twitterMob.addEventListener('click', twitterHandler);


/**
 * INIT
 */
const boot = async () => {
    cache.loadHistory();
    savedQuotePrintHandler();
    const booted = await quoteMachine.updateUI(cache.getLast());

    if(!booted.success) {
        await quoteMachine.updateUI(PRE_FAB_QUOTE);
    }
};

boot();

console.log(cache);

