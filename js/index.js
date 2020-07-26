
const createLog = () => {
    let n = 1;
    return (msg) => {
        if (msg instanceof Error) {
            console.error(`${new Date().getDate()} log#: ${++n} => ${msg}`);
        }
        console.log(`${new Date().getDate()} log#:${++n} => ${msg}`);
    }
}

const log = createLog();

const getQuote = async () => {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const apiUrl = 'http://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en';

    try {
        const res = await fetch(proxyUrl + apiUrl);
        return await res.json();
    } catch (err) {
        log(err);
    }

    return false;
}

const proxyGetQuote = async (_, n = 1) => {

    log(`Trying API: ${n}`);
    const newQuote = await getQuote();

    if (!newQuote) {
        log(`Retrying API in ${n * 500}ms`);
        setTimeout(() => {
            if (n < 5) return proxyGetQuote(n++);
            return false;
        }, n * 500);
    }

    return newQuote;
}

const reactiveDOM = (shadowDOM) => {
    let newQuote = null;

    const updateUI = (nq) => {
        try {
            nq.authorText = newQuote.authorText;
            nq.quoteText = newQuote.quoteText;
        } catch (err) {
            log(err);
            return false;
        }

        return true;
    }

    shadowDOM.getQuoteBtn.addEventListener('click', async () => {
        debugger;
        newQuote = await proxyGetQuote();

        if (newQuote) {
            updateUI(newQuote)
        }
    });

    return {
        exec: updateUI
    }
}

const initShadowDOM = () => {
    return {
        quoteText: document.getElementById('quote'),
        authorText: document.getElementById('author'),
        getQuoteBtn: document.getElementById('new-quote')
    }
}

const manualMode = reactiveDOM(initShadowDOM());
