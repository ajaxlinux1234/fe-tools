const fs = require('fs');
const axios = require('axios');
const { get, isEmpty } = require('lodash');
const { getCurBranch } = require('../util/git-opts');
const loopMsg = require('../util/loop-msg');
const log = require('../util/log');
const eachAsync = require('../util/each-async');
const store = require('../util/store');
const shelljs = require('shelljs');
const { prStoreKey } = require('../util/constants');
/**
 *
 * @param {*} program
 * Function: gitlab provides pr through api
 * Parameters:
 * 1.token: private_token is used when requesting the interface
 * 2.target: target address in the .git directory of the current project | corresponding branch
 * After the first setting, this information will be written to pr.config.json,
 * After that, these two information are read from pr.config.json by default.
 * The form of json is {
 * "target": `${url}|${branch1},${branch2}`
 * }
 * If url is omitted, the address in the .git directory is used by default
 * 3.delete: Read the iid request interface in pr.config.json for close merge request operation
 * 4.pre: the command line before git pr is executed
 * 5.after: command line after git pr is executed
 */
module.exports = function(program) {
    program
        .command('pr')
        .description('Merge request')
        .option('-T,--token <string>', 'user token')
        .option('-L,--open-list', '')
        .option('-TA,--target <string>', 'target paths and branches')
        .option('-D,--delete', 'Delete merge through tool mention')
        .option('-B,--before <string>', 'tools pr hook before execution')
        .option('-A,--after <string>', 'tools pr hook after execution')
        .action(async (info) => {
            const before = info.before || getPrConfig().before;
            before && shelljs.exec(before);
            const target = !isEmpty(getPrInfo(info.target)) ?
                getPrInfo(info.target) :
                getPrConfig().target;
            const originUrl = getOriginUrl();
            const originBranch = getCurBranch();
            const origin = [originUrl, originBranch];
            const token = info.token || getPrConfig().token;
            const tipMsg = [
                [!token, 'user token is require'],
                [get(target, 'length') !== 2, 'target param is not correct'],
            ];
            if (loopMsg(tipMsg) && !info.delete) {
                return;
            }
            const project = await getProject(token);
            if (info.openList) {
                const list = await getMergeList({
                    id: project.id,
                    token,
                })
                return;
            }
            if (info.delete && project.id && getPrConfig().iid) {
                return onDeleteMR({
                    id: project.id,
                    iid: getPrConfig().iid,
                    token,
                });
            }
            const list = await createMR({
                project,
                origin,
                target,
                token,
            });
            if (!list) {
                return;
            }
            (list || []).some((i) => get(i, 'iid')) &&
                log('Merge request was created successfully!');
            const after = info.after || getPrConfig().after;
            await store.set(prStoreKey, {
                target: target,
                token,
                ...(list && { iid: list.map((i) => get(i, 'iid')) }),
                list,
                before,
                after,
            });
            after && shelljs.exec(after);
        });
};

function getOriginUrl(str) {
    const gitConfig = `${process.cwd()}/.git/config`;
    if (!fs.existsSync(gitConfig)) {
        throw new Error('.git/config not exist');
    }
    const gitInfo = fs.readFileSync(gitConfig, 'utf-8');
    return (str || gitInfo).match(/(?<=url = )(.)*(?<=.git)/)[0];
}

function getLatestCommit() {
    const commitFile = `${process.cwd()}/.git/COMMIT_EDITMSG`;
    return fs.readFileSync(commitFile, 'utf-8').trim();
}

function getPrInfo(param) {
    return (param || '')
        .split('|')
        .filter((i) => i.trim())
        .map((i, m) => (m === 0 ? i : i.split(',')));
}

function getPrConfig() {
    return store.get(prStoreKey);
}

// The following code is the related method of git mergeRequest

function getMRPath() {
    return `${new URL(getOriginUrl()).origin}/api/v3`;
}

/**
 *
 * @returns Get git info of current project from list of all projects
 */
async function getProject(token) {
    const MRpath = getMRPath();
    try {
        const res = await axios.get(`${MRpath}/projects?private_token=${token}`);
        const list = get(res, 'data', []);
        return list.find(
            (i) =>
            get(i, 'ssh_url_to_repo') === getOriginUrl() ||
            get(i, 'http_url_to_repo') === getOriginUrl()
        );
    } catch (error) {
        log(error);
    }
}

/**
 * 提pr
 * @param {*} project git information for the current project
 */
async function createMR({ project, origin, target, token }) {
    const { id } = project;
    const branches = target[1];
    try {
        const data = await eachAsync(
            branches.map(
                (i) => async () =>
                    axios.post(`${getMRPath()}/projects/${id}/merge_requests`, {
                        private_token: token,
                        id,
                        source_branch: origin[1],
                        target_branch: i,
                        title: getLatestCommit(),
                    })
            ),
            500
        );
        if (!data) {
            return data;
        }
        return data.map((i) => ({
            ...get(i, 'data', {}),
            iid: get(i, 'data.id', ''),
        }));
    } catch (error) {
        if (get(error, 'response.status') === 409) {
            console.error('Don`t create merge requests repeatedly!');
            return false;
        }
        return log(error);
    }
}

async function deleteMR({ id, iid, token }) {
    return eachAsync(
        iid.map(
            (i) => async () =>
                axios.delete(
                    `${getMRPath()}/projects/${id}/merge_requests/${i}?private_token=${token}`, {
                        private_token: token,
                        id,
                        merge_request_iid: i,
                    }
                )
        ),
        500
    );
}

async function onDeleteMR(params) {
    try {
        const res = await deleteMR(params);
        if (res) {
            store.set(prStoreKey, {
                ...store.get(prStoreKey),
                iid: null
            })
            log(`close merge request successfully!`);
        }
    } catch (error) {
        if (get(error, 'response.status') === 404) {
            console.error('Don`t close merge requests repeatedly!');
            return false;
        }
        return log(error);
    }
}

async function getUsers({ id, token }) {
    const res = await axios.get(
        // `${getMRPath()}/projects/${id}/feature_flags_user_lists?private_token=${token}`
        `${getMRPath()}/users?private_token=${token}`
    );
    return get(res, 'data', []);
}

async function getMergeList({ id, token }) {
    return axios
        .get(
            `${getMRPath()}/projects/${id}/merge_requests?state=opened&&private_token=${token}`
        )
        .then((res) => get(res, 'data', []));
}

// async function updateMR({
//   id
// }) {
//   await axios.put(`/projects/${id}/merge_requests/:merge_request_iid`)
// }