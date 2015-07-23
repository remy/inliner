(function () {

$('a.reveal').click(function (e) {
  e.preventDefault();
  $(this.hash).slideToggle(100);
});

$('#holding h1').html('F<span>&ouml;</span>rbind');

document.addEventListener('keydown', function (event) {
  var esc = event.which == 27,
      nl = event.which == 13,
      el = event.target,
      input = el.nodeName != 'INPUT' && el.nodeName != 'TEXTAREA',
      data = {};

  if (input) {
    if (esc) {
      // restore state
      document.execCommand('undo');
      el.blur();
    } else if (nl) {
      // save
      data[el.getAttribute('data-name')] = el.innerHTML;

      $.ajax({
        url: window.location.toString(),
        data: data,
        type: 'post'
      });

      el.blur();
      event.preventDefault();
    }
  }
}, true);

$('.home table a').closest('tr').click(function () {
  window.location = $(this).find('a').attr('href');
});

// Silly WebKit ditched their required support :(
$('form').submit(function (event) {
  if (!this.checkValidity()) {
    event.preventDefault();
    this.querySelector(':invalid').focus();
  }
});

if ($('body.help').length) {
  // we're on the help page
  $('#toc').append(function () {
    var content = [];
    $('#content').find('h2').each(function (i) {
      content.push('<li><a href="#' + this.id + '">' + this.innerHTML + '</a></li>');
    });
    return content.join('');
  });  
}

if ($('body.editapp').length) {
  var $tabs = $('.tabs a'), 
      $panels = $('.panel');
  
  $(window).bind('hashchange', function () {
    var $panel = $panels.filter(location.hash);
    if ($panel.length) {
      $panels.hide();
      $panel.show();
      $tabs.removeClass('selected').filter('[hash=' + location.hash + ']').addClass('selected');
    }
  }).trigger('hashchange');
}

prettyPrint();



})(); // I don't like globals for some reason...