const { default: axios } = require("axios");
const { prStoreKey } = require("../util/constants");
const store = require("../util/store");
const { getNameSpace } = require("../util/util");
const { get } = require('lodash');

/**
 * Feishu related operations
 * Can be called in the git pr --after hook function,
 * Used to create or update Feishu documents after the git pr operation is completed
 * @param {*} program
 */
module.exports = function(program) {
    program
        .command('feishu')
        .description('Feishu related operations')
        .option('--webhook <string>', 'Send a message to the incoming group bot based on the contents of git pr')
        .action(async (info) => {
            const { webhook } = info;
            if (webhook) {
                const { list } = store.get(prStoreKey);
                const botMsg = transformCardMsg(list);
                await sendBotMsg(webhook, botMsg);
            }
        });
};


async function sendBotMsg(webhook, msg) {
    await axios.post(webhook, {
        ...msg
    })
}


function transformCardMsg(list) {
    const author = get(list, '[0].author', {});
    const { name } = author;
    const prjName = getNameSpace();
    const prCxtList = list.map(i => ({
        "tag": "div",
        "text": {
            "content": `**项目名称**：${prjName} \n\n  **Merge request**:\n内容：${i.title||''} \n地址：${i.web_url}/diffs`,
            "tag": "lark_md"
        }
    }))
    return {
        "msg_type": "interactive",
        "card": {
            "config": {
                "wide_screen_mode": true
            },
            "elements": [{
                    "tag": "div",
                    "text": {
                        "content": `**发起人**：${name}`,
                        "tag": "lark_md"
                    }
                },
                ...prCxtList
            ],
            "header": {
                "template": "orange",
                "title": {
                    "content": "Merge request 提醒",
                    "tag": "plain_text"
                }
            }
        }
    }
}