(function () {
  'use strict';

  window.won = function (n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  };

  // 숫자 입력에 자동으로 천 단위 콤마 표시
  window.parseNum = function (el) {
    return Number(String(el.value).replace(/[^0-9.]/g, '')) || 0;
  };

  document.querySelectorAll('input[data-money]').forEach(function (el) {
    el.setAttribute('inputmode', 'numeric');
    el.addEventListener('input', function () {
      var digits = el.value.replace(/[^0-9]/g, '');
      el.value = digits ? Number(digits).toLocaleString('ko-KR') : '';
    });
  });

  // 현재 페이지 메뉴 강조
  var path = location.pathname.replace(/index\.html$/, '');
  document.querySelectorAll('nav a').forEach(function (a) {
    var href = a.getAttribute('href').replace(/^\.\.\//, '/').replace(/^\.\//, '/');
    if (href !== '/' && path.indexOf(href.replace(/\/$/, '')) !== -1) a.classList.add('active');
  });
})();
