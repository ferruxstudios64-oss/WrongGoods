'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {OwnerLogin,OwnerLogout} from './owner-login';

type Asset = { id: string; name: string; type: string; size: number };
type Draft = {
  id: string; slug: string; code: string; name: string; category: string;
  tone: 'Straight-faced' | 'Satirical'; description: string; contents: string[];
  formats: string[]; compatibility: string; licence: string; priceGBP: number | null;
  providerVariantId: string; images: Asset[]; archive: Asset | null;
  state: 'draft' | 'published' | 'archived'; revision: number; updatedAt: string;
};
const steps = ['The goods', 'Files & images', 'Selling details', 'Preview & publish'];
const currency = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init?.headers } });
  const data = await response.json().catch(() => ({ error: 'The owner service did not return a valid response. Try again.' }));
  if (!response.ok) throw Object.assign(new Error((data as { error?: string }).error || 'The request could not be completed. Try again.'), {status:response.status});
  return data as T;
}

export function OwnerStudio() {
  const [products, setProducts] = useState<Draft[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [uploadsAvailable,setUploadsAvailable]=useState(false);

  function load() {
    return api<{products:Draft[];capabilities?:{uploads:boolean}}>('/api/owner/products')
      .then(data=>{setProducts(data.products);setUploadsAvailable(data.capabilities?.uploads===true);setError('');})
      .catch(e=>setError(e?.status===401?'':e instanceof Error?e.message:'Owner access is unavailable.'))
      .finally(()=>setBusy(false));
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (draft) setDraft({ ...draft, [key]: value });
    setDirty(true); setConfirmed(false); setNotice('');
  }
  function received(product: Draft) {
    setDraft(product); setDirty(false); setConfirmed(false);
    setProducts(current => [product, ...(current || []).filter(p => p.id !== product.id)]);
  }
  async function create() {
    setBusy(true); setError('');
    try { received((await api<{ product: Draft }>('/api/owner/products', { method: 'POST', body: JSON.stringify({ name: 'Untitled collection' }) })).product); setStep(0); setNotice('Private draft created.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function save(): Promise<boolean> {
    if (!draft) return false;
    setBusy(true); setError('');
    try {
      const { id, revision, slug, code, name, category, tone, description, contents, formats, compatibility, licence, priceGBP, providerVariantId } = draft;
      received((await api<{ product: Draft }>(`/api/owner/products/${id}`, { method: 'PUT', body: JSON.stringify({ revision, slug, code, name, category, tone, description, contents: contents.filter(Boolean), formats: formats.filter(Boolean), compatibility, licence, priceGBP, providerVariantId }) })).product);
      setNotice('Draft saved privately.'); return true;
    } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  async function upload(file: File | undefined, kind: 'image' | 'archive') {
    if (!file || !draft) return;
    const limit = kind === 'image' ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > limit) { setError(`Choose a file smaller than ${limit / 1024 / 1024} MB.`); return; }
    if (dirty && !await save()) return;
    setBusy(true); setError('');
    const body = new FormData(); body.append('kind', kind); body.append('file', file);
    try { received((await api<{ product: Draft }>(`/api/owner/products/${draft.id}/upload`, { method: 'POST', body })).product); setNotice(`${file.name} uploaded to private storage.`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function transition(action: 'publish' | 'archive') {
    if (!draft || dirty) return;
    setBusy(true); setError('');
    try { received((await api<{ product: Draft }>(`/api/owner/products/${draft.id}/${action}`, { method: 'POST', body: JSON.stringify({ revision: draft.revision, confirm: true, providerDeliveryVerified: confirmed }) })).product); setNotice(action === 'publish' ? 'Collection published. It is now visible in the storefront.' : 'Collection archived. It is no longer offered for sale.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function removeAsset(asset: Asset) {
    if (!draft || !window.confirm(`Remove ${asset.name} from this collection?`)) return;
    if (dirty) { setError('Save your draft before removing files.'); return; }
    setBusy(true); setError('');
    try { received((await api<{ product: Draft }>(`/api/owner/products/${draft.id}/assets/${asset.id}`, { method: 'DELETE', body: JSON.stringify({ revision: draft.revision }) })).product); setNotice('File removed.'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const problems = draft ? [
    !draft.name.trim() && 'Add a product name.', !draft.code.trim() && 'Add a reference code.', !draft.description.trim() && 'Add a description.',
    !draft.category.trim() && 'Choose a category.', !draft.contents.some(v => v.trim()) && 'List the verified contents.',
    !draft.formats.some(v => v.trim()) && 'List the supplied file formats.', !draft.compatibility.trim() && 'State the tested compatibility.',
    !draft.licence.trim() && 'Add the approved licence terms.', !(draft.priceGBP && draft.priceGBP > 0) && 'Set a GBP price above zero.',
    !draft.providerVariantId.trim() && 'Connect a Lemon Squeezy variant.', !draft.images.length && 'Upload at least one image.',
    !draft.archive && 'Upload the finished ZIP archive.', dirty && 'Save your changes before publishing.',
  ].filter(Boolean) as string[] : [];

  return <main id="main" className="owner-studio">
    {products&&!uploadsAvailable&&<p className="owner-note" role="status">File uploads are not enabled on this preview. You can create and save text drafts; images, archives and publication need private storage.</p>}
    <div className="owner-heading"><div><span className="eyebrow">WRONGGOODS / OWNER STUDIO</span><h1>THE WORKBENCH.</h1><p>Prepare the goods. Check the details. Release when ready.</p></div>{products && <div className="owner-header-links"><a className="text-link" href="/owner/inbox">Inbox &amp; subscribers</a><OwnerLogout/></div>}</div>
    <div className="owner-feedback" aria-live="polite">{notice && <p role="status">{notice}</p>}{error && <p className="owner-error" role="alert">{error}</p>}</div>
    {!products ? <section className="owner-gate"><span className="eyebrow">PRIVATE ACCESS</span><h2>{busy ? 'Checking owner access...' : 'Owner sign-in required.'}</h2>{!busy&&<OwnerLogin onSignedIn={()=>void load()}/>}<Link className="text-link" href="/">Back to the storefront</Link></section> : <div className="owner-layout">
      <aside className="owner-sidebar"><div className="owner-sidebar-heading"><h2>Collections <span>{products.length}</span></h2><button className="button" disabled={busy || dirty} onClick={() => void create()}>+ New draft</button></div><p className="owner-hint">Save changes before switching collections.</p>{!products.length && <p>No collections yet. Start with a private draft.</p>}<div className="owner-list">{products.map(p => <button key={p.id} aria-current={draft?.id === p.id ? 'true' : undefined} disabled={busy || dirty} onClick={() => { setDraft(p); setStep(0); setConfirmed(false); setNotice(''); setError(''); }}><span>{p.name}</span><small>{p.state}</small></button>)}</div></aside>
      {!draft ? <section className="owner-empty"><span className="eyebrow">NOTHING ON THE BENCH.</span><h2>A collection starts here.</h2><p>Add its details, upload the finished files, then check the storefront preview before publishing.</p><button className="button" disabled={busy} onClick={() => void create()}>Create a private draft</button></section> : <section className="owner-editor">
        <div className="owner-editor-heading"><h2>{draft.name || 'Untitled collection'}</h2><span className="owner-state">{draft.state}{dirty ? ' / unsaved changes' : ''}</span></div>
        <nav className="owner-steps" aria-label="Product setup steps">{steps.map((label, index) => <button key={label} aria-current={step === index ? 'step' : undefined} disabled={busy} onClick={() => { setStep(index); setConfirmed(false); }}><span>0{index + 1}</span>{label}</button>)}</nav>
        {draft.state === 'published' && <p className="owner-note">This collection is live. Archive it below before editing or replacing files, then preview and publish again.</p>}
        <fieldset className="owner-fields" disabled={busy || draft.state === 'published'}>
          {step === 0 && <><h3>Give it an identity.</h3><p>Describe the actual collection. Only claim contents and compatibility you have checked.</p><label>Product name<input maxLength={120} value={draft.name} onChange={e => update('name', e.target.value)} /></label><div className="owner-field-pair"><label>URL slug<input value={draft.slug} spellCheck={false} onChange={e => update('slug', e.target.value)} /><small>Lowercase words separated by hyphens.</small></label><label>Reference code<input value={draft.code} onChange={e => update('code', e.target.value)} /></label></div><label>Description<textarea rows={5} maxLength={4000} value={draft.description} onChange={e => update('description', e.target.value)} /></label><div className="owner-field-pair"><label>Category<select value={draft.category} onChange={e => update('category', e.target.value)}><option value="">Choose a category</option>{['Fictional brands', 'Signs & graphics', 'Props & paperwork'].map(c => <option key={c}>{c}</option>)}</select></label><label>Tone<select value={draft.tone} onChange={e => update('tone', e.target.value as Draft['tone'])}><option>Straight-faced</option><option>Satirical</option></select></label></div></>}
          {step === 1 && <><h3>The actual goods.</h3><p>Use finished product images and the deliverable ZIP. Images remain private until publishing. Archives stay private.</p><label className="owner-upload">Add a product image<input type="file" disabled={!uploadsAvailable} accept="image/jpeg,image/png,image/webp" onChange={e => { void upload(e.target.files?.[0], 'image'); e.target.value = ''; }} /><small>JPEG, PNG or WebP. Maximum 10 MB per image.</small></label><div className="owner-thumbnails">{draft.images.map(asset => <figure key={asset.id}><img src={`/api/owner/media/${asset.id}`} alt={asset.name} width={240} height={180}/><figcaption>{asset.name}</figcaption><button className="owner-secondary" onClick={() => void removeAsset(asset)}>Remove image</button></figure>)}</div><label className="owner-upload">{draft.archive ? 'Replace downloadable archive' : 'Add downloadable archive'}<input type="file" disabled={!uploadsAvailable} accept=".zip,application/zip" onChange={e => { void upload(e.target.files?.[0], 'archive'); e.target.value = ''; }} /><small>ZIP only. Maximum 25 MB. Inspect its contents before publishing.</small></label>{draft.archive && <p className="owner-note">Attached: {draft.archive.name} ({(draft.archive.size / 1024 / 1024).toFixed(1)} MB)</p>}<label>Verified contents<textarea rows={5} value={draft.contents.join('\n')} onChange={e => update('contents', e.target.value.split('\n'))}/><small>One item per line. Be specific about the files included.</small></label><label>File formats<textarea rows={3} value={draft.formats.join('\n')} onChange={e => update('formats', e.target.value.split('\n'))}/><small>One format per line, for example PNG. Do not add unverified formats.</small></label><label>Tested compatibility<textarea rows={3} value={draft.compatibility} onChange={e => update('compatibility', e.target.value)}/><small>State the applications and versions actually tested, or explain the limits.</small></label></>}
          {step === 2 && <><h3>Set the terms.</h3><p>Match the price and product variant to your Lemon Squeezy setup. Checkout is validated on the server.</p><div className="owner-field-pair"><label>Price (GBP)<input type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.priceGBP ?? ''} onChange={e => update('priceGBP', e.target.value === '' ? null : Number(e.target.value))}/></label><label>Lemon Squeezy variant ID<input inputMode="numeric" value={draft.providerVariantId} onChange={e => update('providerVariantId', e.target.value)} /><small>Use the variant for this collection and price.</small></label></div><label>Approved licence terms<textarea rows={12} value={draft.licence} onChange={e => update('licence', e.target.value)} /><small>Include permitted use, restrictions and redistribution terms. These terms will appear on the product page.</small></label></>}
          {step === 3 && <><div className="owner-preview-label"><span className="eyebrow">STOREFRONT PREVIEW</span><span>Private until published</span></div><article className="owner-preview">{draft.images[0] ? <img className="owner-preview-image" src={`/api/owner/media/${draft.images[0].id}`} alt={`Preview of ${draft.name}`} width={640} height={480}/> : <div className="owner-preview-placeholder">PRODUCT IMAGE REQUIRED</div>}<div><span className="eyebrow">{draft.category} / {draft.tone}</span><h3>{draft.name || 'Untitled collection'}</h3><p>{draft.description || 'Add the collection description.'}</p><p className="price">{draft.priceGBP ? currency.format(draft.priceGBP) : 'Price required'}</p><h4>Included in the collection</h4><ul>{draft.contents.filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}</ul><h4>Formats & compatibility</h4><p>{draft.formats.filter(Boolean).join(' / ')}</p><p>{draft.compatibility || 'Compatibility statement required.'}</p><h4>Licence</h4><p className="owner-licence">{draft.licence || 'Approved terms required.'}</p></div></article><div className="owner-publish"><h3>Release check.</h3>{problems.length ? <><p>Complete these items before publishing:</p><ul>{problems.map(problem => <li key={problem}>{problem}</li>)}</ul></> : <p>The required fields and files are present. Publishing also runs server validation and checks the connected checkout.</p>}<label className="owner-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I have inspected the archive, attached the matching customer download to this Lemon Squeezy variant, verified these product claims and approved the licence. This collection is ready for customers.</span></label><button className="button" disabled={busy || !confirmed || problems.length > 0 || draft.state === 'published'} onClick={() => void transition('publish')}>{busy ? 'Checking release...' : 'Publish collection ...'}</button></div></>}
        </fieldset>
        <div className="owner-actions"><button className="owner-secondary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Working...' : 'Save draft'}</button>{step > 0 && <button className="owner-secondary" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}{step < 3 && <button className="button" disabled={busy} onClick={async () => { if (!dirty || await save()) setStep(step + 1); }}>Continue to {steps[step + 1].toLowerCase()} ...</button>}</div>
        {draft.state === 'published' && <div className="owner-archive"><p>Taking this collection off sale preserves the record for existing orders.</p><button className="owner-secondary" disabled={busy || dirty} onClick={() => { if (window.confirm('Archive this collection and remove it from sale? Existing order access is preserved.')) void transition('archive'); }}>Archive collection</button></div>}
      </section>}
    </div>}
  </main>;
}
