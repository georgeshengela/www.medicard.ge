/** Campaign editor keeps its canvas styles isolated from the admin shell. */
window.renderPosterStudio = function(){
  const root=document.getElementById('tab-poster-studio');
  if(root.querySelector('iframe'))return;
  const frame=document.createElement('iframe');
  frame.src='./poster-studio/index.html';
  frame.title='MEDICARD — პოსტერების სტუდია';
  frame.style.cssText='display:block;width:100%;height:calc(100dvh - 190px);min-height:720px;border:1px solid var(--border,#233140);border-radius:16px;background:#080e18';
  root.style.setProperty('--v3-page-max','none');
  root.replaceChildren(frame);
};
