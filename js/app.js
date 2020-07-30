/**
 * Constants
 */

const MAX_ATTEMPTS = 50;
const PRE_FAB_QUOTE = {
    quoteText: 'Look with favour upon a bold beginning.',
    quoteAuthor: 'Virgil'
};

const ACTION = 'action';
const MUTATION = 'mutation';
const RESTING = 'resting';

const $eventKey = {
    STATE_CHANGE: 'stateChange',
    LOADING_QUOTE: 'loadingQuote',
    PREV_QUOTE: 'prevQuote',
    NEXT_QUOTE: 'nextQuote',
}

const $actionKey = {
    INIT: 'init',
    GET_QUOTE: 'getQuote',
    GET_LIBRARY_QUOTE: 'getLibraryQuote',
    UPDATE_CURRENT_QUOTE: 'updateCurrentQuote',
    LOADING_QUOTE: 'loadingQuote',
    SAVE_QUOTE: 'saveQuote',
    PREV_QUOTE: 'prevQuote',
    NEXT_QUOTE: 'nextQuote',
    PREV: 'previous',
    STOP: 'stop',
    PLAY: 'play',
    NEXT: 'next',
    TWEET: 'tweet',
    FORGET: 'forget',
    UPDATE_LOCAL_STORAGE: 'updateLocalStorage',
    SEARCH: 'search'
};

const $mutationKey = {
    LOADING_QUOTE: 'loadingQuote',
    SAVE_QUOTE: 'saveQuote',
    PREV_QUOTE: 'prevQuote',
    NEXT_QUOTE: 'nextQuote',
    UPDATE_LOCAL_STORAGE: 'updateLocalStorage',
    SEARCH: 'search'
}

const $ = (element) => document.querySelector(element);
const $all = (element) => document.querySelectorAll(element);


/**
 * State
 */

// const state = {
//     history: [],
//     savedQuotes: []
// };

class State {
    constructor(quoteLibrary) {
        this.quoteLibrary = quoteLibrary.map(q => {
            return {
                date: q.date,
                quoteAuthor: q.quoteAuthor,
                quoteText: q.quoteText.substring(0, q.quoteText.length - 1),
            };
        });
        this.history = [];
        this.savedQuotes = [];
        this.loadHistory();
        this.loadSavedQuotes();
        this.pointToEnd();

        //this.quoteAlreadyExistsInCache();
    }

    createLog(nq) {
        if (this.quoteAlreadyExistsInCache(nq)) return;

        this.history.push({
            date: Date.now(),
            quoteText: nq.quoteText,
            quoteAuthor: nq.quoteAuthor || 'Anon'
        });

        this.saveHistory();
        this.pointToEnd();

        this.quoteAlreadyExistsInCache({ quoteText: 'Creativity requires the courage to let go of certainties. ', quoteAuthor: 'Erich Fromm'});
    }

    quoteAlreadyExistsInCache(quote) {
        let exists = false;
        this.history.forEach((q, idx) => {
            if (q.quoteText === quote.quoteText) exists = true;
        });

        return exists;
    }

    convertCacheToJSON() {

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
        return this.history[this.history.length - 1] || PRE_FAB_QUOTE;
    }

    pointToEnd() {
        this.pointer = this.history.length - 1;
    }

    isAtEnd() {
        return this.pointer >= this.history.length - 1;
    }

    isOneFromEnd() {
        return this.pointer >= this.history.length - 2;
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
    init: function(context, payload) {
        log('App initialising', 'lightblue');

        context.events.subscribe($actionKey.UPDATE_CURRENT_QUOTE, (data) => {
            context.dispatch($actionKey.UPDATE_CURRENT_QUOTE, data);
        });
        
        context.events.subscribe($actionKey.INIT, (data) => {
            context.dispatch($actionKey.INIT, data);
        });

        context.events.subscribe($eventKey.LOADING_QUOTE, (data) => {
            context.dispatch($actionKey.LOADING_QUOTE, data);
        });
    },

    getQuote: async function(context, payload) {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const apiUrl = 'http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en';
        let attempts = 1;

        context.events.publish($eventKey.LOADING_QUOTE, 'loading');

        const failLimiter = async (attempts) =>{
            try {
                const response = await fetch(proxyUrl + apiUrl);
                return await response.json();
            } catch (err) {
                log(err);
                if (attempts < MAX_ATTEMPTS) {
                    utils.sleep(25);
                    log(`Retrying API: attempt ${++attempts}`)
                    return failLimiter(attempts);
                }
            }
        };

        let data = await failLimiter(attempts);

        while(data.quoteText === context.state.getLast().quoteText) {
            log('Duplicate quote. Retrying.', 'red');
            data = await failLimiter(attempts);
        }

        if (data && attempts <= MAX_ATTEMPTS) {
            log(`Retrieved quote from API after ${attempts} attempt${attempts == 1 ? '' : 's'}`, 'green');
            context.events.publish($actionKey.UPDATE_CURRENT_QUOTE, data);
        }

        if (!data && attempts >= MAX_ATTEMPTS) {
            throw new Error(`Unable to retrieve quote from API after ${attempts} attempt${attempts == 1 ? '' : 's'}`);
        }

        context.events.publish($eventKey.LOADING_QUOTE, null);

    },

    getLibraryQuote: async function(context, payload) {
        context.events.publish($eventKey.LOADING_QUOTE, 'loading');

        await utils.sleep(utils.getRandomInt(1000, 5000));
        const newQuote = context.state.quoteLibrary[utils.getRandomInt(1, context.state.quoteLibrary.length - 1)];
        context.events.publish($actionKey.UPDATE_CURRENT_QUOTE, newQuote);

        context.events.publish($eventKey.LOADING_QUOTE, null);
    },

    // search(context, data) {

    // },

    updateCurrentQuote: function(context, data) {
        context.commit('persistQuote', data);
        // context.commit('saveHistory');
        // context.commit('pointToEnd');
    },

    loadingQuote: function(context, data) {
        context.commit($mutationKey.LOADING_QUOTE, data);
    },

    saveQuote: function(context, payload) {
        context.commit($mutationKey.SAVE_QUOTE, payload);
    },

    prevQuote: function(context, payload) {
        context.commit($mutationKey.PREV_QUOTE, payload);
    },

    nextQuote: function(context, payload) {
        context.commit($mutationKey.NEXT_QUOTE, payload);
    },

    updateLocalStorage: function(context, payload) {
        context.commit($mutationKey.UPDATE_LOCAL_STORAGE);
    },

    tweetCurrentQuote: function(context, payload) {
        const url = `https://twitter.com/intent/tweet?text=${payload.quoteText} ~ ${payload.quoteAuthor}`;

        window.open(url, '_blank');
    }
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
    },

    loadingQuote: function(state, payload) {
        $('#new-quote').innerText = payload === 'loading' ? 'Loading...' : 'New Quote';
        $('.loader').hidden = payload === 'loading' ? false : true;
        $('.quote-text').hidden = payload === 'loading' ? true : false;
        $('.quote-author').hidden = payload === 'loading' ? true : false;
    },

    saveQuote: function(state, payload) {
        state.createFavourite();
        return state;
    },

    prevQuote: function(state, payload) {
        state.prev();
        return state;
    },

    nextQuote: function(state, payload) {
        state.next();
        return state;
    },

    updateLocalStorage: function(state, payload) {
        state.saveHistory();
        state.persistSavedQuotes();
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

        self.actions = params.actions;
        self.mutations = params.mutations;
        self.events = params.events;

        self.previousStateCache = {};

        self.state = new Proxy((params.state || {}), {
            set: function(state, key, value) {

                state[key] = value;
                self.previousStateCache[key] = value;

                console.log(`${$eventKey.STATE_CHANGE}: ${key}:`, value);
                
                self.events.publish($eventKey.STATE_CHANGE);

                return true;
            }
        });
    }

    dispatch(actionKey, payload) {
        if (typeof(this.actions[actionKey]) !== 'function') {
            console.warn(`${actionKey} is not a registered action`);
            return false;
        }

        console.groupCollapsed(`ACTION: ${actionKey} ${Date.now()}`);

        this.actions[actionKey](this, payload);

        console.groupEnd();

        return true;
    }

    commit(mutationKey, payload) {
        if(typeof(this.mutations[mutationKey]) !== 'function') {
            console.warn(`${this.mutations[mutationKey]} is not a registered mutation`);
            return false;
        }

        console.groupCollapsed(`MUTATION: ${mutationKey} ${Date.now()}`);

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

        this.render();
    }

    render() {
        const activeQuote = store.state.get() || PRE_FAB_QUOTE;
        this.elements.authorText.innerText = activeQuote.quoteAuthor;
        this.elements.quoteText.innerText = activeQuote.quoteText;

        //debugger;

        activeQuote.quoteText.length > 50 
            ? this.elements.quoteText.classList.add('long-quote') 
            : this.elements.quoteText.classList.remove('long-quote')
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
        });

        this.render();
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
        });

        this.render();
    }

    delete(idx) {
        store.state.savedQuotes = store.state.savedQuotes.filter((_, i) => i !== idx);
        store.dispatch($actionKey.UPDATE_LOCAL_STORAGE);
    }

    render() {
        const self = this;
        this.elements.favsList.innerHTML = store.state.savedQuotes.map((q, i) => {
            return `<li class="favs-list-item" data-index="${i}">${q.quoteText}
                        <span class="favs-list-author">${q.quoteAuthor}</span>
                        <i class="fas fa-times"></i>
                    </li>`
        }).join('');

        Array.from($all('[data-index]')).map((node, i) => {
            node.addEventListener('click', self.delete.bind(self, i));
        });
    }
}

class NavigationManager {
    constructor(dom, store) {
        this.playInterval = null;
        this.timeInterval = null;
        this.timeRemaining = $('#ms');
        this.stopHandlerEnabled = true;
        this.playHandlerEnabled = true;
        this.store = store;
        this.dom = dom;

        this.dom.prevBtn.addEventListener('click', this.prevHandler.bind(this));
        this.dom.stopBtn.addEventListener('click', this.stopHandler.bind(this));
        this.dom.playBtn.addEventListener('click', this.playHandler.bind(this));
        this.dom.nextBtn.addEventListener('click', this.nextHandler.bind(this));
    }

    prevHandler() {
        this.store.dispatch($actionKey.PREV_QUOTE);
    }

    stopHandler() {
        if (this.stopHandlerEnabled) {
            this.stopTimer();
    
            this.timeRemaining.innerText = 4.5;
    
            this.ifShowingHideTimer();
    
            this.stopHandlerEnabled = false;
            this.playHandlerEnabled = true;
    
            return;
        }
    
        log('stopHandler disabled', 'red');
    }

    playHandler() {
        if (this.playHandlerEnabled) {
            this.ifHidingShowTimer();

            this.playInterval = setInterval(() => {
                this.nextHandler();
            }, 4500);
    
            this.timeInterval = setInterval(() => {
                if(this.timeRemaining.innerText > 0) {
                    this.timeRemaining.innerText = (this.timeRemaining.innerText - 0.1).toFixed(1);
                    return;
                }
    
                this.timeRemaining.innerText = 4.5;
            
            }, 100);
    
            this.stopHandlerEnabled = true;
            this.playHandlerEnabled = false;
    
            return;
        }
    
        log('playHandler disabled', 'red');
    }

    nextHandler() {
        if (this.store.state.isOneFromEnd()) {
            this.stopTimer();
            return;
        }
    
        this.store.dispatch($actionKey.NEXT_QUOTE);
    }

    stopTimer() {
        this.ifShowingHideTimer();

        clearInterval(this.playInterval);
        clearInterval(this.timeInterval);
        this.playInterval = null;
        this.timeInterval = null;
    }

    ifShowingHideTimer() {
        if (Array.from(this.timeRemaining.classList).indexOf('hidden') === -1) {
            this.timeRemaining.classList.add('hidden');
        }
    }

    ifHidingShowTimer() {
        if (Array.from(this.timeRemaining.classList).indexOf('hidden') !== -1) {
            this.timeRemaining.classList.remove('hidden');
        }
    }

}

/**
 * Utils
 */

const utils = {

    deepEqual: function(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    },

    createLog: function() {
        let n = 0;
        return (msg, color = null) => {
            if (msg instanceof Error) {
                console.error(`${new Date().toISOString()}-LOG-#${++n} => ${msg}`);
                return false;
            }
            console.log(`%c${new Date().toISOString()}-LOG-#${++n} => ${msg}`, `${color ? 'color:' + color : ''}`);
            return true;
        }
    },

    timeout: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    sleep: async function(ms) {
        return await Promise.all([this.timeout(ms / 2)], [this.timeout(ms / 2)]);
    }, 

    getRandomInt: function(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    },

    fetchDomRefences: function() {
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

console.time('bootTime');

const dom = utils.fetchDomRefences();
const log = utils.createLog();

const store = new StoreFactory({
    actions,
    mutations,
    state: new State(quoteLibrary),
    events: new EventManager()
});

store.dispatch($actionKey.INIT);

const currentQuote = new CurrentQuote(store);
const quoteTracker = new QuoteTracker(store);
const savedQuotes = new SavedQuotesList(store);
const navigationManager = new NavigationManager(dom, store);

dom.getQuoteBtn.addEventListener('click', () => store.dispatch($actionKey.GET_LIBRARY_QUOTE));
dom.saveBtn.addEventListener('click', () => store.dispatch($actionKey.SAVE_QUOTE));

dom.twitterTab.addEventListener('click', store.dispatch.bind(store, 'tweetCurrentQuote', store.state.get()));
dom.twitterMob.addEventListener('click', store.dispatch.bind(store, 'tweetCurrentQuote', store.state.get()));


console.timeEnd('bootTime');

// generate quoteLibrary data
// let enough = setInterval(() => {
//     if (store.state.history.length > 2000) {
//         return clearInterval(enough);
//     }
//     store.dispatch($actionKey.GET_QUOTE);
// }, 1000);

