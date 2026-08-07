import { useEffect, useMemo, useRef } from 'react'

function normalizeTextArtifacts(value) {
  return String(value ?? '')
    .replace(/\u00e2\u20ac\u00a2/g, '-')
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac[\u0153\u009d]/g, '"')
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, '-')
    .replace(/\u00c2\u00b7/g, '-')
    .replace(/\u00c2/g, '')
    .replace(/\u00a0/g, ' ')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(value) {
  const normalized = String(value ?? '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function sanitizeNode(node, documentRef) {
  if (node.nodeType === Node.TEXT_NODE) {
    return documentRef.createTextNode(normalizeTextArtifacts(node.textContent ?? ''))
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const tagName = node.tagName.toLowerCase()
  const inlineTags = new Set(['b', 'strong', 'i', 'em', 'u', 'br'])
  const blockTags = new Set(['p', 'div', 'ul', 'ol', 'li'])

  if (!inlineTags.has(tagName) && !blockTags.has(tagName)) {
    const fragment = documentRef.createDocumentFragment()
    for (const child of node.childNodes) {
      const sanitizedChild = sanitizeNode(child, documentRef)
      if (sanitizedChild) fragment.appendChild(sanitizedChild)
    }
    return fragment
  }

  const element = documentRef.createElement(tagName)
  if (blockTags.has(tagName)) {
    const textAlign = node.style?.textAlign
    if (['left', 'center', 'right', 'justify'].includes(textAlign)) {
      element.style.textAlign = textAlign
    }
  }

  for (const child of node.childNodes) {
    const sanitizedChild = sanitizeNode(child, documentRef)
    if (sanitizedChild) element.appendChild(sanitizedChild)
  }

  return element
}

function normalizeEditorHtml(value) {
  const raw = normalizeTextArtifacts(value).trim()
  if (!raw) return ''

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(raw)
  const sourceHtml = looksLikeHtml ? raw : plainTextToHtml(raw)
  const parser = new DOMParser()
  const parsed = parser.parseFromString(`<div>${sourceHtml}</div>`, 'text/html')
  const wrapper = parsed.body.firstElementChild
  if (!wrapper) return ''

  const cleanDocument = document.implementation.createHTMLDocument('')
  const fragment = cleanDocument.createDocumentFragment()
  for (const child of wrapper.childNodes) {
    const sanitizedChild = sanitizeNode(child, cleanDocument)
    if (sanitizedChild) fragment.appendChild(sanitizedChild)
  }

  const container = cleanDocument.createElement('div')
  container.appendChild(fragment)
  return container.innerHTML
}

export default function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  minHeightClass = 'min-h-[9rem]',
  placeholder = '',
  fieldName,
}) {
  const editorRef = useRef(null)
  const normalizedValue = useMemo(() => normalizeEditorHtml(value), [value])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (document.activeElement === editor) return
    if (editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue
    }
  }, [normalizedValue])

  const syncValue = ({ normalize = false } = {}) => {
    const editor = editorRef.current
    if (!editor) return
    if (!normalize) {
      onChange(editor.innerHTML)
      return
    }

    const normalizedHtml = normalizeEditorHtml(editor.innerHTML)
    if (editor.innerHTML !== normalizedHtml) {
      editor.innerHTML = normalizedHtml
    }
    onChange(normalizedHtml)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white" data-field-name={fieldName}>
      <div className="relative">
        {!readOnly && !normalizedValue && placeholder && (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-slate-400">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          data-field-name={fieldName}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={() => syncValue()}
          onBlur={() => syncValue({ normalize: true })}
          className={`portal-input rounded-none border-0 bg-transparent px-4 py-3 focus:ring-0 ${minHeightClass}`}
          style={{ whiteSpace: 'pre-wrap' }}
        />
      </div>
    </div>
  )
}

