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

const $eventKey = {
    STATE_CHANGE: 'stateChange'
}

const $actionKey = {
    GET_QUOTE: 'getQuote',
    SAVE_QUOTE: 'saveQuote',
    PREV: 'previous',
    STOP: 'stop',
    PLAY: 'play',
    NEXT: 'next',
    TWEET: 'tweet',
    FORGET: 'forget',
};

const $ = (element) => document.querySelector(element);


/**
 * State
 */

// const state = {
//     history: [],
//     savedQuotes: []
// };

class State {
    constructor() {
        this.history = [];
        this.savedQuotes = [];
        this.loadHistory();
        this.loadSavedQuotes();
        this.pointToEnd();
    }

    createLog(nq) {
        this.history.push({
            date: Date.now(),
            quoteText: nq.quoteText,
            quoteAuthor: nq.quoteAuthor || 'Anon'
        });

        // this.saveHistory();
        // this.pointToEnd();
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

    getQuote: async function(context, payload) {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const apiUrl = 'http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en';
        let attempts = 1;

        const failLimiter = async (attempts) =>{
            try {
                const response = await fetch(proxyUrl + apiUrl);
                return await response.json();
            } catch (err) {
                log(err);
                if (attempts < MAX_ATTEMPTS) {
                    utils.sleep(100);
                    log(`Retrying API: attempt ${++attempts}`)
                    return failLimiter(attempts);
                }
            }
        };

        const data = await failLimiter(attempts);

        if (data && attempts <= MAX_ATTEMPTS) {
            context.commit('persistQuote', data);
            context.commit('saveHistory');
            context.commit('pointToEnd');
        }

        if (!data && attempts >= MAX_ATTEMPTS) {
            throw new Error(`Unable to retrieve quote from API after ${n} attempt${n == 1 ? '' : 's'}`);
        }

    },

    example: function(context, payload) {
        context.commit('mutationKeyName', payload);
    },


}

/**
 * Mutations (always modify state)
 */

const mutations = {

    persistQuote: function(state, payload) {
        state.createLog(payload);
        return state;
    },

    saveHistory: function(state) {
        state.saveHistory();
        return state;
    },

    pointToEnd: function(state) {
        state.pointToEnd();
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
        if(!this.events.hasOwnProperty(event)) {
            this.events[event] = [];
        }

        return this.events[event].push(callback);
    }

    publish(event, data = {}) {
        if(!this.events.hasOwnProperty(event)) {
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

        self.status = RESTING;
        self.actions = params.actions;
        self.mutations = params.mutations;
        self.events = params.events;

        self.state = new Proxy((params.state || {}), {
            set: function(state, key, value) {
                state[key] = value;

                console.log(`${$eventKey.STATE_CHANGE}: ${key}:`, value);
                
                self.events.publish($eventKey.STATE_CHANGE);

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

        console.groupCollapsed(`MUTATION: ${mutationKey}`);

        const newState = this.mutations[mutationKey](this.state, payload);

        this.state = Object.assign(this.state, newState);

        console.groupEnd();

        return true;
    }
}

/**
 * Base Component
 */

class Component {
    constructor(props) {
        this.render = this.render || function noop() {};

        if (props.store instanceof StoreFactory) {
            props.store.events.subscribe($eventKey.STATE_CHANGE, () => this.render());
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

class CurrentQuote extends Component {
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
        this.elements.authorText.innerHTML = activeQuote.quoteAuthor;
        this.elements.quoteText.innerHTML = activeQuote.quoteText;
    }
}

class QuoteTracker extends Component {
    constructor(store) {
        super({
            store: store,
            elements: {
                nominator: $('#nominator'),
                denominator: $('#denominator')
            }
        })
    }

    render() {
        this.elements.nominator.innerText = store.state.getPointer() + 1;
        this.elements.denominator.innerText = store.state.getLength();
    }
}

class SavedQuotesList extends Component {
    constructor(store) {
        super({
            store: store,
            elements: {
                favsList: $('#favs-list')
            }
        })
    }

    render() {
        // const createItemHtml = (q) => {
        //     let str = `<li class="favs-list-item">`;
        //     str += `${q.quoteText}`;
        //     str += `<span class="favs-list-author">${q.quoteAuthor}</span>`;
        //     str += `<i class="fas fa-times"></i>`;
        //     str += `</li>`;
    
        //     return str;
        // }
    
        // this.elements.favsList.innerHTML = store.state.savedQuotes.map(quote => createItemHtml(quote)).join('');

        this.elements.favsList.innerHTML = store.state.savedQuotes.map(q => {
            return `<li class="favs-list-item">${q.quoteText}
                        <span class="favs-list-author">${q.quoteAuthor}</span>
                        <i class="fas fa-times"></i>
                    </li>`
        }).join('');
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
        return {
            quoteText: $('#quote'),
            authorText: $('#author'),
            getQuoteBtn: $('#new-quote'),
            favContainer: $('#fav-container'),
            favTitleBox: $('#fav-title-text'),
            favsList: $('#favs-list'),
            saveBtn: $('#save-quote'),
            prevBtn: $('#prev'),
            stopBtn: $('#stop'),
            playBtn: $('#play'),
            nextBtn: $('#next'),
            twitterTab: $('#twitter-tablet'),
            twitterMob: $('#twitter-mobile'),
            nominator: $('#nominator'),
            denominator: $('#denominator')
        }
    }

};

/**
 * Init
 */

// store.events.subscribe($actionKey.GET_QUOTE, (data) => {

// });

// store.events.subscribe($actionKey.SAVE_QUOTE, (data) => {

// });

// store.events.subscribe($actionKey.PREV, (data) => {

// });

// store.events.subscribe($actionKey.STOP, (data) => {

// });

// store.events.subscribe($actionKey.PLAY, (data) => {

// });

// store.events.subscribe($actionKey.NEXT, (data) => {

// });

// store.events.subscribe($actionKey.TWEET, (data) => {

// });

// store.events.subscribe($actionKey.FORGET, (data) => {

// });



const dom = utils.domRef();
const log = utils.createLog();

const store = new StoreFactory({
    actions,
    mutations,
    state: new State(),
    events: new EventManager()
});

const currentQuote = new CurrentQuote(store);
const quoteTracker = new QuoteTracker(store);
const savedQuotes = new SavedQuotesList(store);

dom.getQuoteBtn.addEventListener('click', () => store.dispatch($actionKey.GET_QUOTE));

// dom.prevBtn.addEventListener('click', prevHandler);
// dom.stopBtn.addEventListener('click', clearInterval(playInterval));
// dom.playBtn.addEventListener('click', () => playInterval = setInterval(nextHandler, 4500));
// dom.nextBtn.addEventListener('click', nextHandler);
// dom.saveBtn.addEventListener('click', saveHander);
// dom.twitterTab.addEventListener('click', twitterHandler);
// dom.twitterMob.addEventListener('click', twitterHandler);

// let playInterval = null;

// const trackerHandler = () => {
//     dom.nominator.innerHTML = cache.getPointer() + 1;
//     dom.denominator.innerHTML = cache.getLength();
// };

// trackerHandler();

// const prevHandler = () => {
//     const prevQuote = cache.prev().get();
//     dom.quoteText.innerHTML = prevQuote.quoteText;
//     dom.authorText.innerHTML = prevQuote.quoteAuthor;
//     trackerHandler();
// };

// const nextHandler = () => {
//     if (cache.isAtEnd()) {
//         clearInterval(playInterval);
//         playInterval = null;
//         return;
//     }

//     const nextQuote = cache.next().get();
//     dom.quoteText.innerHTML = nextQuote.quoteText;
//     dom.authorText.innerHTML = nextQuote.quoteAuthor;
//     trackerHandler();
// };

// const saveHander = () => {

//     cache.createFavourite();
//     savedQuotePrintHandler();
// };

