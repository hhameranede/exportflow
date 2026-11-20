export const MARKETING_JS = `(function(){
  "use strict";
  var languageControls=document.querySelectorAll("[data-language]");
  var match=window.location.pathname.match(/^\\/(en|ar|fr|es|de|pt|zh|ja)(\\/.*)?$/);
  var currentLocale=match?match[1]:"en";
  var currentPath=match?(match[2]||"/"):window.location.pathname;
  languageControls.forEach(function(control){
    control.value=currentLocale;
    control.addEventListener("change",function(){
      var target=control.value==="en"?currentPath:"/"+control.value+(currentPath==="/"?"":currentPath);
      window.location.assign(target);
    });
  });
  var menu=document.querySelector("[data-menu-toggle]");
  var drawer=document.querySelector("[data-mobile-drawer]");
  if(menu&&drawer){
    function toggle(open){menu.setAttribute("aria-expanded",String(open));drawer.classList.toggle("is-open",open);}
    menu.addEventListener("click",function(){toggle(menu.getAttribute("aria-expanded")!=="true");});
    drawer.addEventListener("click",function(event){if(event.target.closest("a"))toggle(false);});
    document.addEventListener("keydown",function(event){if(event.key==="Escape")toggle(false);});
  }
  var steps=document.querySelectorAll(".ef-process-list li");
  if("IntersectionObserver" in window&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}});},{threshold:.18});
    steps.forEach(function(step){observer.observe(step);});
  }else{steps.forEach(function(step){step.classList.add("is-visible");});}
  var form=document.querySelector("[data-contact-form]");
  if(form){form.addEventListener("submit",function(event){event.preventDefault();var status=form.querySelector("[data-form-status]");status.dataset.state="error";status.textContent="This form is not connected to a support system yet. Your message has not been sent.";});}
})();`;
