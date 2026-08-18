/* 検証中だけ、ウェブフォントの取得を外へ飛ばさんようにする。

   なぜ:
   dist/ の唯一の外部参照が Google Fonts（DotGothic16）で、ネットワークが一瞬詰まると
   ERR_CONNECTION_CLOSED がコンソールエラーになって検証が落ちる。落ちてほしいんは
   **コードの壊れ**であって、ネットワークの機嫌やない。

   なぜ「無視」やのうて「飛ばさん」か:
   エラーを握り潰すと、フォント関係の本物の異常も一緒に隠れる。
   飛ばさんのなら揺らぎの原因そのものが無い。中断（abort）やのうて空CSSを返すんは、
   中断すると net::ERR_FAILED が別のエラーとして出るけん。

   見た目は MS ゴシックに落ちるが、検証は見た目を見とらん（掟：見るのはJSエラーと決定論）。 */
const FONT_HOSTS = /fonts\.(googleapis|gstatic)\.com/;

module.exports = function offlineFonts(browser) {
  const orig = browser.newPage.bind(browser);
  browser.newPage = async function (...args) {
    const pg = await orig(...args);
    await pg.route(FONT_HOSTS, route => {
      route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
    });
    return pg;
  };
  return browser;
};
