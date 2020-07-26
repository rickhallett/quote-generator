/**
 * Constants
 */

const MAX_ATTEMPTS = 10;
const PRE_FAB_QUOTE = {
    quoteText: 'Look with favour upon a bold beginning.',
    quoteAuthor: 'Virgil'
};

const ACTION = 'action';
const MUTATION = 'mutation';
const RESTING = 'resting';


/**
 * State
 */

const state = {
    history: [],
    savedQuotes: []
};

/**
 * Actions
 */

const actions = {

    example: function(context, payload) {
        context.commit('mutationKeyName', payload);
    },

    getForismaticQuote: function() {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const apiUrl = 'http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en';

        try {
            const res = await fetch(proxyUrl + apiUrl);
            return await res.json();
        } catch (err) {
            return log(err);
        }
    },


    quoteLimiter: async function (_, n = 1) {
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
    },

    updateUI: async function(nq) {
        try {
            shadowDOM.authorText.innerHTML = nq.quoteAuthor;
            shadowDOM.quoteText.innerHTML = nq.quoteText;
        } catch (err) {
            log(err);
            return { success: false, error: err };
        }

        return { success: true, error: null };
    },

    tryGetQuote: async function(_, missingDataTryCount = 1) {
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


}

/**
 * Mutations
 */

const mutations = {

    example: function(state, payload) {
        state.history.push('yolo');

        return state;
    }

}

/**
 * Store
 */

class Store {
    constructor(params) {
        const self = this;

        self.status = null;
        self.actions = params.actions;
        self.mutations = params.mutations;
        self.events = new EventManager();

        self.state = new Proxy((params.state || {}), {
            set: function(state, key, value) {
                state[key] = value;

                console.log(`stateChange = { ${key}: ${value} }`);
                
                self.events.publish('stateChange');

                if (self.status !== MUTATION) {
                    console.warn(`You should use a mutation to set ${key}`);
                }

                self.status = RESTING;

                return true;
            }
        });
    }

    dispatch(actionKey, payload) {
        if (typeof(this.actions[actionKey]) !== 'function') {
            console.warn(`${actionKey} is not a registered action`);
            return false;
        }

        console.groupCollapsed(`ACTION: ${actionKey}`);

        this.status = ACTION;

        this.actions[actionKey](this, payload);

        console.groupEnd();

        return true;
    }

    commit(mutationKey, payload) {
        if(typeof(this.mutations[mutationKey]) !== 'function') {
            console.warn(`${this.mutations[mutationKey]} is not a registered mutation`);
            return false;
        }

        this.status = MUTATION;

        const newState = this.mutations[mutationKey](this.state, payload);

        this.state = Object.assign(this.state, newState);

        return true;
    }
}

/**
 * Pub/Sub
 */

class EventManager {
    constructor() {
        this.events = [];
    }

    subscribe(event, callback) {
        if(!this.events[event].hasOwnProperty(event)) {
            this.events[event] = [];
        }

        return this.events[event].push(callback);
    }

    publish(event, data = {}) {
        if(!this.events[event].hasOwnProperty(event)) {
            throw new Error(`EventManager does not have ${event} subscribed`);
        }

        return this.events[event].map(cb => cb(data));
    }
}

/**
 * Base Component
 */

/**
 * UI Components
 */

/**
 * Utils
 */

const utils = {

    createLog: function() {
        let n = 0;
        return (msg) => {
            if (msg instanceof Error) {
                console.error(`${new Date().toISOString()}-LOG-#${++n} => ${msg}`);
                return false;
            }
            console.log(`${new Date().toISOString()}-LOG-#${++n} => ${msg}`);
            return true;
        }
    },

    timeout: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    sleep: async function(ms) {
        return await Promise.all([this.timeout(ms / 2)], [this.timeout(ms / 2)]);
    }, 

    domRef: function() {
        const $ = document.getElementById;
        return {
            quoteText: $('quote'),
            authorText: $('author'),
            getQuoteBtn: $('new-quote'),
            favContainer: $('fav-container'),
            favTitleBox: $('fav-title-text'),
            favsList: $('favs-list'),
            saveBtn: $('save-quote'),
            prevBtn: $('prev'),
            stopBtn: $('stop'),
            playBtn: $('play'),
            nextBtn: $('next'),
            twitterTab: $('twitter-tablet'),
            twitterMob: $('twitter-mobile'),
            nominator: $('nominator'),
            denominator: $('denominator')
        }
    }

};

/**
 * Cache
 */

class QuoteCacheManager {
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

/**
 * Init
 */

const dom = utils.domRef();
const log = utils.createLog();

dom.prevBtn.addEventListener('click', prevHandler);
dom.stopBtn.addEventListener('click', clearInterval(playInterval));
dom.playBtn.addEventListener('click', () => playInterval = setInterval(nextHandler, 4500));
dom.nextBtn.addEventListener('click', nextHandler);
dom.saveBtn.addEventListener('click', saveHander);
dom.twitterTab.addEventListener('click', twitterHandler);
dom.twitterMob.addEventListener('click', twitterHandler);

let playInterval = null;

const trackerHandler = () => {
    dom.nominator.innerHTML = cache.getPointer() + 1;
    dom.denominator.innerHTML = cache.getLength();
};

trackerHandler();

const prevHandler = () => {
    const prevQuote = cache.prev().get();
    dom.quoteText.innerHTML = prevQuote.quoteText;
    dom.authorText.innerHTML = prevQuote.quoteAuthor;
    trackerHandler();
};

const nextHandler = () => {
    if (cache.isAtEnd()) {
        clearInterval(playInterval);
        playInterval = null;
        return;
    }

    const nextQuote = cache.next().get();
    dom.quoteText.innerHTML = nextQuote.quoteText;
    dom.authorText.innerHTML = nextQuote.quoteAuthor;
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

    dom.favsList.innerHTML = cache.savedQuotes.map(quote => createItemHtml(quote)).join('');
};