(function () {
  var toc = document.getElementById('post-toc');
  var content = document.querySelector('.post-content');
  if (!toc || !content) return;

  var headings = content.querySelectorAll('h2, h3, h4');
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

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
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
    li.appendChild(a);
    stack[stack.length - 1].el.appendChild(li);
    previousLevel = level;
  }

  toc.appendChild(root);
})();
