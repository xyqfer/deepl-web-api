const { CookieJar } = require('tough-cookie');
const got = require('got');

const getId = () => {
    return 1e4 * Math.round(1e4 * Math.random()) + 2;
};

const getTimestamp = (jobs) => {
    let n = 1;
    let r = Date.now();
    jobs.forEach(function(e) {
        return n += ((e.raw_en_sentence || "").match(/[i]/g) || []).length;
    });
    
    return r + (n - r % n);
};

const cookieJar = new CookieJar();
const req = async (data) => {
    const resp = await got('https://www2.deepl.com/jsonrpc', {
        method: 'POST',
        responseType: 'json',
        cookieJar,
        body: JSON.stringify(data).replace('"method":', '"method": '),
        headers: {
            'Content-Type': 'text/plain',
            'referer': 'https://www.deepl.com/translator',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36'
        }
    });

    return resp.body;
};

module.exports = async (text = '', source = 'EN', target = 'ZH') => {
    let id = getId();

    let resp = await req({
        "jsonrpc": "2.0",
        "method": "LMT_split_into_sentences",
        "params": {
            "texts": [text],
            "lang": {
                "lang_user_selected": source,
                "user_preferred_langs": ["DE","FR","IT","ES","ZH","EN"]
            }
        },
        "id": id++
    });

    const sentences = resp.result.splitted_texts[0];
    const jobs = sentences.reduce((acc, item, index) => {
        let raw_en_context_before = [];
        let raw_en_context_after = [];
        
        if (index > 0) {
            raw_en_context_before.push(sentences[index - 1]);
        }
        
        if (index < sentences.length - 1) {
            raw_en_context_after.push(sentences[index + 1]);
        }
    
        acc.push({
            kind: "default",
            raw_en_sentence: item,
            raw_en_context_before,
            raw_en_context_after,
            preferred_num_beams: 1,
        });
        return acc;
    }, []);

    let data = {
        "jsonrpc": "2.0",
        "method": "LMT_handle_jobs",
        "params": {
            "jobs": jobs,
            "lang": {
                "user_preferred_langs": ["DE","FR","IT","ES","ZH","EN"],
                "source_lang_computed": source,
                "target_lang": target
            },
            "priority": 1,
            "commonJobParams": {
                "formality": null
            },
        },
        "id": id++
    };
    data.params.timestamp = getTimestamp(jobs);
    resp = await req(data);

    return resp.result.translations.reduce((acc, item) => {
        const text = item.beams[0].postprocessed_sentence;
        return acc + text;
    }, '');
};