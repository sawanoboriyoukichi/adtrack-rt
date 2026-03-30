/**
 * adtrack-rt tracker.js
 * LPに埋め込むトラッキングスクリプト
 *
 * 使い方:
 * <script src="https://YOUR_DOMAIN/t.js" data-site="YOUR_SITE_ID"></script>
 */
(function () {
  'use strict';

  // 設定
  var script = document.currentScript;
  var ENDPOINT = script ? script.src.replace(/\/t\.js.*$/, '') : '';
  var SITE_ID = (script && script.getAttribute('data-site')) || 'default';

  // ユーティリティ
  function generateId() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + value + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function getUTMParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_term: params.get('utm_term') || '',
      utm_content: params.get('utm_content') || '',
    };
  }

  // visitor_id管理（1年間保持）
  var visitorId = getCookie('_atrt_vid');
  if (!visitorId) {
    visitorId = generateId();
    setCookie('_atrt_vid', visitorId, 365);
  }

  var currentSessionId = null;

  // ページビュー送信
  function trackPageview() {
    var utm = getUTMParams();
    var payload = {
      visitor_id: visitorId,
      page_url: window.location.href,
      page_title: document.title,
      referrer: document.referrer,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_term: utm.utm_term,
      utm_content: utm.utm_content,
      site_id: SITE_ID,
    };

    fetch(ENDPOINT + '/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.session_id) {
          currentSessionId = data.session_id;
        }
      })
      .catch(function () { /* silent fail */ });
  }

  // イベント送信（グローバル関数として公開）
  window.atrtEvent = function (eventName, options) {
    options = options || {};
    if (!currentSessionId) {
      // セッションIDがまだない場合はキューイング
      setTimeout(function () { window.atrtEvent(eventName, options); }, 500);
      return;
    }

    var payload = {
      session_id: currentSessionId,
      visitor_id: visitorId,
      event_name: eventName,
      event_category: options.category || null,
      event_label: options.label || null,
      event_value: options.value ?? null,
      page_url: window.location.href,
      metadata: options.metadata || null,
      site_id: SITE_ID,
    };

    fetch(ENDPOINT + '/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(function () { /* silent fail */ });
  };

  // 自動イベント検知: フォーム送信
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var formId = form.id || form.getAttribute('name') || 'unknown_form';
    window.atrtEvent('form_submit', { label: formId });
  });

  // 自動イベント検知: 外部リンククリック
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.href;
    try {
      var url = new URL(href);
      if (url.hostname !== window.location.hostname) {
        window.atrtEvent('outbound_click', { label: href });
      }
    } catch (err) { /* ignore invalid URLs */ }
  });

  // SPA対応: History API監視
  var origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    trackPageview();
  };
  window.addEventListener('popstate', trackPageview);

  // 初回ページビュー送信
  if (document.readyState === 'complete') {
    trackPageview();
  } else {
    window.addEventListener('load', trackPageview);
  }
})();
