const {Octokit} = require('@octokit/rest');
const request = require('superagent');
const {default: PQueue} = require('p-queue');


async function getGithubRepositories(username, token) {
  const octokit = new Octokit({
    auth: token || null,
  });
  return octokit.paginate('GET /user/repos')
    .then(repositories => toRepositoryList(repositories));
}

function toRepositoryList(repositories) {
  return repositories.map(repository => {
    return { name: repository.name, url: repository.clone_url }
  });
}

async function getGiteaUser(gitea) {
  return request.get(gitea.url
    + '/api/v1/user')
    .query(`access_token=${gitea.token}`)
    .then(response => {
      return { id: response.body.id, name: response.body.username }
    });
}

function isAlreadyMirroredOnGitea(repository, gitea, giteaUser) {
  const requestUrl = `${gitea.url}/api/v1/repos/${giteaUser.name}/${repository}`;
  return request.get(
    requestUrl)
    .query(`access_token=${gitea.token}`)
    .then(() => true)
    .catch(() => false);
}

function mirrorOnGitea(repository, gitea, giteaUser, github) {
  var url = `${gitea.url}/api/v1/repos/migrate`
  var query = `access_token=${gitea.token}`
  var post = {
    auth_username: github.username,
    auth_token: github.token,
    clone_addr: repository.url,
    mirror: true,
    lfs: true,
    private: true,
    pull_requests: true,
    releases: true,
    repo_name: repository.name,
    uid: giteaUser.id,
  }

  request.post(url)
    .query(query)
    .send(post)
    .then(() => {
      console.log('Did it!');
    })
    .catch(err => {
      console.log('Failed', err);
    });

}

async function mirror(repository, gitea, giteaUser, github) {
  if (await isAlreadyMirroredOnGitea(repository.name,
    gitea,
    giteaUser)) {
    console.log('Repository is already mirrored; doing nothing: ', repository.name);
    return;
  }
  console.log('Mirroring repository to gitea: ', repository.name);
  await mirrorOnGitea(repository, gitea, giteaUser, github);
}

async function main() {
  const githubUsername = process.env.GITHUB_USERNAME;
  if (!githubUsername) {
    console.error('No GITHUB_USERNAME specified, please specify! Exiting..');
    return;
  }
  const githubToken = process.env.GITHUB_TOKEN;
  const giteaUrl = process.env.GITEA_URL;
  if (!giteaUrl) {
    console.error('No GITEA_URL specified, please specify! Exiting..');
    return;
  }

  const github = {
    username: githubUsername,
    token: githubToken,
  };

  const giteaToken = process.env.GITEA_TOKEN;
  if (!giteaToken) {
    console.error('No GITEA_TOKEN specified, please specify! Exiting..');
    return;
  }


  const githubRepositories = await getGithubRepositories(githubUsername, githubToken);
  console.log(`Found ${githubRepositories.length} repositories on github`);

  const gitea = {
    url: giteaUrl,
    token: giteaToken,
  };
  const giteaUser = await getGiteaUser(gitea);

  const queue = new PQueue({ concurrency: 4 });
  await queue.addAll(githubRepositories.map(repository => {
    return async () => {
      await mirror(repository, gitea, giteaUser, github);
    };
  }));
}

main();
