(function () {
  var toc = document.getElementById('post-toc');
  var content = document.querySelector('.post-content');
  if (!toc || !content) return;

  var headings = content.querySelectorAll('h2, h3, h4, h5, h6');
  if (headings.length === 0) {
    toc.classList.add('post-toc--empty');
    return;
  }

  function slugify(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  var title = document.createElement('div');
  title.className = 'post-toc-title';
  title.textContent = 'On this page';
  toc.appendChild(title);

  var root = document.createElement('ul');
  var stack = [{ el: root, level: 1 }];
  var previousLevel = 0;

  for (var i = 0; i < headings.length; i++) {
    var h = headings[i];
    var level = parseInt(h.tagName.charAt(1), 10);
    var id = h.id || slugify(h.textContent);
    if (!h.id) h.id = id;

    while (stack.length > 1 && stack[stack.length - 1].level > level) {
      stack.pop();
    }
    var parent = stack[stack.length - 1].el;
    var lastLi = parent.lastElementChild;
    if (level > previousLevel && lastLi) {
      var newUl = document.createElement('ul');
      newUl.className = 'post-toc-ul-' + level;
      lastLi.appendChild(newUl);
      stack.push({ el: newUl, level: level });
    }

    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = h.textContent;
    a.setAttribute('data-toc-id', id);
    li.appendChild(a);
    stack[stack.length - 1].el.appendChild(li);
    previousLevel = level;
  }

  toc.appendChild(root);

  function setActiveId(activeId) {
    var links = toc.querySelectorAll('a[data-toc-id]');
    for (var j = 0; j < links.length; j++) {
      links[j].classList.toggle('is-active', links[j].getAttribute('data-toc-id') === activeId);
    }
  }

  function updateActiveFromScroll() {
    var topOffset = 120;
    var viewportHeight = window.innerHeight;
    var activeId = null;
    var lastVisibleId = null;
    for (var i = 0; i < headings.length; i++) {
      var rect = headings[i].getBoundingClientRect();
      if (rect.top <= topOffset) {
        activeId = headings[i].id;
      }
      if (rect.top < viewportHeight && rect.bottom > 0) {
        lastVisibleId = headings[i].id;
      }
    }
    if (!activeId) activeId = lastVisibleId;
    if (!activeId && headings.length > 0) activeId = headings[0].id;
    setActiveId(activeId);
  }

  window.addEventListener('scroll', function () {
    window.requestAnimationFrame(updateActiveFromScroll);
  }, { passive: true });
  updateActiveFromScroll();
})();
