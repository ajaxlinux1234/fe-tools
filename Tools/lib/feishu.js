const { default: axios } = require("axios");
const { prStoreKey } = require("../util/constants");
const store = require("../util/store");
const { getNameSpace } = require("../util/util");
const { get } = require('lodash');

/**
 * 飞书相关操作
 * 可以在git pr --after钩子函数调用，
 * 在git pr操作完成后用于创建或者更新飞书文档
 * @param {*} program
 */
module.exports = function(program) {
    program
        .command('feishu')
        .description('飞书相关操作')
        .option('--webhook <string>', '根据git pr的内容，向传入的group bot发消息')
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