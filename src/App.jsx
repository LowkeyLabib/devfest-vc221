import { useEffect, useRef, useState } from 'react'
import { messages } from './i18n'
import { withinUploadLimits, validateRequirements, requirementStatus, isBlocking, canAssign } from './model'
import { readPdf } from './pdfReader'
import { buildPackage, downloadPackage } from './packagePdf'

const symbols = { missing: '!', expiryNeeded: '!', expired: '!', notProvided: '–', ok: '✓' }

export default function App() {
  const [language, setLanguage] = useState('en')
  const [dataset, setDataset] = useState(null)
  const [files, setFiles] = useState([])
  const [matches, setMatches] = useState({})
  const [notices, setNotices] = useState([])
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [success, setSuccess] = useState(false)
  const processing = useRef(false)
  const t = messages[language]
  const number = value => new Intl.NumberFormat(language === 'bn' ? 'bn-BD' : 'en-US', { maximumFractionDigits: 1 }).format(value)
  useEffect(() => { document.documentElement.lang = language }, [language])
  const notify = (code, name = '') => setNotices(old => [...old, { code, name }])
  const byId = Object.fromEntries(files.map(file => [file.id, file]))
  const rows = dataset?.requirements.map(r => ({ r, file: byId[matches[r.id]?.fileId], status: requirementStatus(r, byId[matches[r.id]?.fileId], matches[r.id]?.expiry, dataset.tender.submission_deadline) })) || []
  const blockers = rows.filter(row => isBlocking(row.status))
  const included = rows.filter(row => row.file)
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const disabled = busy || generating

  async function loadJson(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || processing.current) return
    processing.current = true; setBusy(true); setSuccess(false); setNotices([])
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('jsonLarge')
      let parsed
      try { parsed = JSON.parse(await file.text()) } catch { throw new Error('jsonError') }
      const validated = validateRequirements(parsed)
      setDataset(validated); setMatches({})
    } catch (error) { notify(messages.en[error.message] ? error.message : 'jsonError', file.name) }
    finally { processing.current = false; setBusy(false) }
  }

  async function upload(event) {
    const incoming = Array.from(event.target.files || [])
    event.target.value = ''
    if (!incoming.length || processing.current) return
    processing.current = true; setBusy(true); setSuccess(false); setNotices([])
    const accepted = []
    try {
      for (const file of incoming) {
        if (!/\.pdf$/i.test(file.name) || (file.type && !['application/pdf', 'application/x-pdf', 'application/octet-stream'].includes(file.type))) { notify('nonPdf', file.name); continue }
        if (!withinUploadLimits([...files, ...accepted], file.size)) { notify('limit', file.name); continue }
        try {
          const document = await readPdf(file)
          accepted.push(document)
        } catch (error) { notify(['nonPdf', 'noPages'].includes(error.message) ? error.message : 'badPdf', file.name) }
      }
      setFiles(old => [...old, ...accepted])
    } finally { processing.current = false; setBusy(false) }
  }

  function assign(r, fileId) {
    setSuccess(false)
    if (!canAssign(r.id, fileId, matches, files)) { notify('duplicateMatch'); return }
    setMatches(old => ({ ...old, [r.id]: { fileId, expiry: '' } }))
  }
  function remove(id) {
    setFiles(old => old.filter(file => file.id !== id))
    setMatches(old => Object.fromEntries(Object.entries(old).filter(([, match]) => match.fileId !== id)))
    setSuccess(false)
  }
  async function generate() {
    if (!dataset || blockers.length || processing.current) return
    processing.current = true; setGenerating(true); setSuccess(false); setNotices([])
    try {
      const bytes = await buildPackage(dataset, files, matches)
      downloadPackage(bytes, dataset.tender.tender_id); setSuccess(true)
    } catch (error) { notify(messages.en[error.message] ? error.message : 'generationError') }
    finally { processing.current = false; setGenerating(false) }
  }

  return <>
    <header className="topbar"><div className="brand"><span className="brand-icon" aria-hidden="true">▤</span>{t.brand}</div>
      <div className="language" aria-label={t.language}><button aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button><button aria-pressed={language === 'bn'} onClick={() => setLanguage('bn')}>বাংলা</button></div>
    </header>
    <main>
      <section className="hero"><div className="eyebrow"><span aria-hidden="true">◈</span> {t.privacy}</div><h1>{t.heading}</h1><p>{t.intro}</p></section>
      <nav className="steps" aria-label={t.intro}>{['step1', 'step2', 'step3', 'step4'].map((key, i) => <a href={`#step-${i + 1}`} key={key}><span>{number(i + 1)}</span>{t[key]}</a>)}</nav>
      {notices.length > 0 && <section className="notice" role="alert"><div className="section-head"><strong>{t.notices}</strong><button className="text-button" onClick={() => setNotices([])}>{t.dismiss}</button></div><ul>{notices.map((notice, i) => <li key={i}>{notice.name && <strong>{notice.name}: </strong>}{t[notice.code]}</li>)}</ul></section>}
      <section id="step-1" className="card"><div className="section-head"><div><div className="step-label">{number(1)} / {t.step1}</div><h2>{t.loadTitle}</h2><p>{t.loadHelp}</p></div><label className={`button ${disabled ? 'disabled' : ''}`}>{dataset ? t.replaceJson : t.chooseJson}<input aria-label={t.chooseJson} type="file" accept=".json,application/json" disabled={disabled} onChange={loadJson} /></label></div>
        {dataset && <><dl className="tender-details">{[['tenderId', 'tender_id'], ['title', 'title'], ['entity', 'procuring_entity'], ['bidder', 'bidder'], ['deadline', 'submission_deadline']].map(([label, key]) => <div key={key}><dt>{t[label]}</dt><dd>{dataset.tender[key]}</dd></div>)}</dl><p className="small">{t.changeHelp}</p></>}
      </section>
      <section id="step-2" className="card"><div className="section-head"><div><div className="step-label">{number(2)} / {t.step2}</div><h2>{t.uploadTitle}</h2><p>{t.uploadHelp}</p></div><label className={`button secondary ${disabled ? 'disabled' : ''}`}>{t.choosePdfs}<input aria-label={t.choosePdfs} type="file" accept=".pdf,application/pdf" multiple disabled={disabled} onChange={upload} /></label></div>
        <div className="tray-meta"><span>{number(files.length)} / {number(30)} {t.files}</span><span>{number(totalBytes / 1_000_000)} / {number(50)} {language === 'bn' ? 'এমবি' : 'MB'}</span>{busy && <span role="status">{t.reading}</span>}</div>
        {!files.length ? <div className="empty"><span aria-hidden="true">▤</span><p>{t.emptyFiles}</p></div> : <ul className="file-list">{files.map(file => {
          const duplicate = files.filter(other => other.hash === file.hash).length > 1
          const assigned = Object.values(matches).some(match => byId[match.fileId]?.hash === file.hash)
          return <li key={file.id}><span className="pdf-icon" aria-hidden="true">PDF</span><div className="file-info"><strong>{file.name}</strong><span>{number(file.pages)} {file.pages === 1 ? t.page : t.pages} · {number(file.size / 1_000)} {language === 'bn' ? 'কেবি' : 'KB'}</span></div><div className="file-tags">{duplicate && <span className="tag duplicate">{t.duplicate}</span>}<span className="tag">{assigned ? t.assigned : t.available}</span></div><button className="text-button danger" disabled={disabled} onClick={() => remove(file.id)} aria-label={`${t.remove}: ${file.name}`}>{t.remove}</button></li>
        })}</ul>}
      </section>
      <section id="step-3" className="card"><div className="step-label">{number(3)} / {t.step3}</div><h2>{t.matchTitle}</h2><p>{t.matchHelp}</p>
        {!dataset ? <div className="empty"><p>{t.loadFirst}</p></div> : <div className="requirements">{rows.map(({ r, file, status }) => <article className="requirement" key={r.id}>
          <div className="requirement-heading"><span className="order">{number(r.order)}</span><div><h3>{r[language === 'bn' ? 'title_bn' : 'title_en']}</h3><span className="small">{r.mandatory ? t.mandatory : t.optional} · {r.id}</span></div><div className={`status ${status}`}><span aria-hidden="true">{symbols[status]}</span><div>{t[status]}<small>{isBlocking(status) ? t.blocking : t.nonBlocking}</small></div></div></div>
          <div className="match-fields"><label>{t.select}<select aria-label={`${t.select}: ${r[language === 'bn' ? 'title_bn' : 'title_en']}`} disabled={disabled} value={matches[r.id]?.fileId || ''} onChange={e => assign(r, e.target.value)}><option value="">{t.noMatch}</option>{files.map(f => { const allowed = canAssign(r.id, f.id, matches, files); return <option key={f.id} value={f.id} disabled={!allowed}>{f.name}{!allowed ? ` — ${t.used}` : ''}</option> })}</select></label>
          {file && r.has_expiry && <label>{t.expiry}<input type="date" disabled={disabled} value={matches[r.id]?.expiry || ''} onChange={e => { setMatches(old => ({ ...old, [r.id]: { ...old[r.id], expiry: e.target.value } })); setSuccess(false) }} aria-label={`${t.expiry}: ${r[language === 'bn' ? 'title_bn' : 'title_en']}`} /><span className="small">{t.expiryHelp} {dataset.tender.submission_deadline}</span></label>}</div>
        </article>)}</div>}
      </section>
      <section id="step-4" className="card generate-card"><div className="step-label">{number(4)} / {t.step4}</div><h2>{t.generateTitle}</h2><p>{t.generateHelp}</p>
        {dataset && <div className="package-stats"><span><strong>{number(included.length)}</strong> {t.included}</span><span><strong>{number(1 + included.reduce((sum, row) => sum + row.file.pages, 0))}</strong> {t.totalPages}</span></div>}
        <div id="generation-reason" aria-live="polite">{!dataset ? <p>{t.loadFirst}</p> : blockers.length ? <div className="blocking-summary"><strong>{t.blockers}</strong><ul>{blockers.map(({ r, status }) => <li key={r.id}>{r[language === 'bn' ? 'title_bn' : 'title_en']} — {t[status]}</li>)}</ul></div> : <p className="ready">✓ {t.ready}</p>}{busy && <p>{t.busy}</p>}</div>
        <button className="button generate-button" disabled={!dataset || blockers.length > 0 || disabled} aria-describedby="generation-reason" onClick={generate}>{generating ? t.generating : t.generate}<span aria-hidden="true"> ↓</span></button>
        {success && <p role="status" className="ready">✓ {t.success}</p>}
      </section>
      <footer className="app-footer">{t.footerNote}</footer>
    </main>
  </>
}
