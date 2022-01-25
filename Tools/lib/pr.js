const fs = require('fs');
const { getCurBranch } = require('../util/git-opts');
const loopMsg = require('../util/loop-msg');
const log = require('../util/log');
const axios = require('axios');
const { get, isEmpty } = require('lodash');
const eachAsync = require('../util/each-async');
const store = require('../util/store');
const prStoreKey = 'pr';
/**
 *
 * @param {*} program
 * 功能: gitlab通过api提pr
 * 参数：
 *  1.token: private_token请求接口的时候使用
 *  2.target: 当前项目.git目录下的target地址|对应的分支
 *  第一次设置完之后会把这个信息写到pr.config.json中，
 *  之后默认从pr.config.json中读取这两个信息。
 *  json的形式为{
 *    "target": `${url}|${branch1},${branch2}`
 *  }
 *  url如果省略默认使用.git目录下的地址
 *  3.delete: 讀取pr.config.json中的iid請求接口進行close merge request 操作
 *  4.pre: git pr 执行前的命令行
 *  5.after: git pr执行后的命令行
 */
module.exports = function (program) {
  program
    .command('pr')
    .description('Merge request')
    .option('--token <string>', '用户token')
    .option('--target <string>', '目标路径和分支')
    .option('--delete', '刪除通過工具提的merge')
    .action(async (info) => {
      const target = !isEmpty(getPrInfo(info.target))
        ? getPrInfo(info.target)
        : getPrConfig().target;
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
      if (info.delete && project.id) {
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
      store.set(prStoreKey, {
        target: target,
        token,
        ...(list && { iid: list.map((i) => get(i, 'iid')) }),
      });
      (list || []).some((i) => get(i, 'iid')) &&
        log('Merge request was created successfully!');
      // const users = await getUsers({ id: project.id, token });
      // console.log(users);
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

// 下面代码为git mergeRequest相关方法

function getMRPath() {
  return `${new URL(getOriginUrl()).origin}/api/v3`;
}

/**
 *
 * @returns 从所有项目列表中获取当前项目的git信息
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
 * @param {*} project 当前项目的git信息
 */
async function createMR({ project, origin, target, token }) {
  const { id } = project;
  const branches = target[1];
  try {
    const list = await eachAsync(
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
    return list.map((i) => ({
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
          `${getMRPath()}/projects/${id}/merge_requests/${i}?private_token=${token}`,
          {
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
    await deleteMR(params);
  } catch (error) {
    if (get(error, 'response.status') === 404) {
      console.error('Don`t close merge requests repeatedly!');
      return false;
    }
    return log(error);
  }
  log(`close merge request successfully!`);
}

async function getUsers({ id, token }) {
  const res = await axios.get(
    // `${getMRPath()}/projects/${id}/feature_flags_user_lists?private_token=${token}`
    `${getMRPath()}/users?private_token=${token}`
  );
  return get(res, 'data', []);
}

// async function getMergeList({ id, token }) {
//   return axios
//     .get(
//       `${getMRPath()}/projects/${id}/merge_requests?state=opened&&private_token=${token}`
//     )
//     .then((res) => get(res, 'data', []));
// }

// async function updateMR({
//   id
// }) {
//   await axios.put(`/projects/${id}/merge_requests/:merge_request_iid`)
// }
