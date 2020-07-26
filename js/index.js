const MAX_ATTEMPTS = 3;

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

const proxyGetQuote = async (_, n = 1) => {
    log(`Trying API: ${n}`);
    let data = await getQuote();

    if (!data) {
        const delay = 500 + (n * 50);

        if (n < MAX_ATTEMPTS) {
            log(`Retrying API in ${delay}ms`);
            sleep(delay);
            return await proxyGetQuote(null, ++n);
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
        let { data, n } = await proxyGetQuote(null, missingDataTryCount);

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

const initShadowDOM = () => {
    return {
        quoteText: document.getElementById('quote'),
        authorText: document.getElementById('author'),
        getQuoteBtn: document.getElementById('new-quote')
    }
}

const log = createLog();
const manualMode = reactiveDOM(initShadowDOM());

manualMode.exec();
