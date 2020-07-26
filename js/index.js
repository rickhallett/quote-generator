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

const $evt = {
    STATE_CHANGE: 'stateChange',
    GET_QUOTE: 'getQuote',
    SAVE_QUOTE: 'saveQuote',
    PREV: 'previous',
    STOP: 'stop',
    PLAY: 'play',
    NEXT: 'next',
    TWEET: 'tweet',
    FORGET: 'forget',
};

const $ = (context, element) => (context || document).querySelector(element);


/**
 * State
 */

// const state = {
//     history: [],
//     savedQuotes: []
// };

class State {
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
 * Actions (do not directly modify state)
 */

const actions = {

    getQuote: function(context, payload) {
        let { data, n } = await quoteLimiter(null, missingDataTryCount);

        if (data && n <= MAX_ATTEMPTS) {
            cache.createLog(data);
            trackerHandler();
            return log(`UI updated successfully after ${n} attempt${n == 1 ? '' : 's'}`);
        }

        if (!data && n >= MAX_ATTEMPTS) {
            throw new Error(`Unable to retrieve quote from API after ${n} attempt${n == 1 ? '' : 's'}`);
        }
    },

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
        let data = await this.getForismaticQuote();
    
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


}

/**
 * Mutations (always modify state)
 */

const mutations = {

    example: function(state, payload) {
        state.history.push('yolo');

        return state;
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
 * Store
 */

class StoreFactory {
    constructor(params) {
        const self = this;

        self.status = null;
        self.actions = params.actions;
        self.mutations = params.mutations;
        self.events = params.events;

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

        console.groupCollapsed(`MUTATION: ${actionKey}`);

        const newState = this.mutations[mutationKey](this.state, payload);

        this.state = Object.assign(this.state, newState);

        console.groupEnd();

        return true;
    }
}

const store = new StoreFactory({
    actions,
    mutations,
    state: new State(),
    events: new EventManager()
});



/**
 * Base Component
 */

class Component {
    constructor(props) {
        this.render = this.render || function noop() {};

        if (props.store instanceof Store) {
            props.store.subscribe($evt.STATE_CHANGE, () => this.render());
        }

        if (props.hasOwnProperty('element')) {
            this.element = props.element;
        }

        if (props.hasOwnProperty('elements')) {
            this.elements = props.elements;
        }
    }
}

/**
 * UI Components
*/

class CurrentQuote {
    constructor(store) {
        super({
            store: store,
            elements: {
                quoteText: $('#quote'),
                authorText: $('#author'),
            } 
        });
    }

    render() {
        const activeQuote = store.state.get();
        elements.authorText.innerHTML = activeQuote.quoteAuthor;
        elements.quoteText.innerHTML = activeQuote.quoteText;
    }
}

class QuoteTracker {
    constructor(store) {
        super({
            store: store,
            elements: {
                nominator: $('nominator'),
                denominator: $('denominator')
            }
        })
    }

    render() {
        elements.nominator.innerHTML = store.state.getPointer() + 1;
        elements.denominator.innerHTML = store.state.getLength();
    }
}

class SavedQuotes {
    constructor(store) {
        super({
            store: store,
            elements: {
                favsList: $('#favs-list')
            }
        })
    }

    render() {
        const createItemHtml = (q) => {
            let str = `<li class="favs-list-item">`;
            str += `${q.quoteText}`;
            str += `<span class="favs-list-author">${q.quoteAuthor}</span>`;
            str += `<i class="fas fa-times"></i>`;
            str += `</li>`;
    
            return str;
        }
    
        elements.favsList.innerHTML = store.state.savedQuotes.map(quote => createItemHtml(quote)).join('');
    }
}

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
 * Init
 */

store.state.subscribe($evt.GET_QUOTE, (data) => {

});

store.state.subscribe($evt.SAVE_QUOTE, (data) => {

});

store.state.subscribe($evt.PREV, (data) => {

});

store.state.subscribe($evt.STOP, (data) => {

});

store.state.subscribe($evt.PLAY, (data) => {

});

store.state.subscribe($evt.NEXT, (data) => {

});

store.state.subscribe($evt.TWEET, (data) => {

});

store.state.subscribe($evt.FORGET, (data) => {

});



const dom = utils.domRef();
const log = utils.createLog();

dom.getQuoteBtn.addEventListener('click', store.dispatch($evt.GET_QUOTE));

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

