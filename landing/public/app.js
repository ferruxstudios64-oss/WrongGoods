const form=document.querySelector('#signup-form');
if(form){
  const status=document.querySelector('#signup-status');const error=document.querySelector('#signup-error');const button=form.querySelector('button');button.disabled=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const data=new FormData(form);button.disabled=true;button.textContent='Saving…';status.textContent='';error.textContent='';
    try{
      const response=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),consent:data.get('consent')==='on',website:data.get('website')}),signal:AbortSignal.timeout(15000)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Your request was not saved. Please try again.');
      status.textContent=result.message||'You’re on the release list. Check your inbox for confirmation.';form.reset();
    }catch(e){error.textContent=e.name==='TimeoutError'?'The request timed out. Please try again; duplicate signups won’t be added twice.':e.message||'Could not connect. Please try again.';}
    finally{button.disabled=false;button.innerHTML='Keep me posted <span aria-hidden="true">↗</span>';}
  });
}
