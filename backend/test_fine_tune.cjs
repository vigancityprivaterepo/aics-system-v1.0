const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

function fineTuneSignatureAlignmentOnly(doc) {
  let changed = false;

  // 1. Convert floating wp:anchor to inline drawings for signature images
  const drawings = Array.from(doc.getElementsByTagName('w:drawing'));
  for (const drawing of drawings) {
    const extents = Array.from(drawing.getElementsByTagName('wp:extent'));
    const isQr = extents.some(e => e.getAttribute('cx') === '762000' && e.getAttribute('cy') === '762000');
    if (isQr) continue;

    const anchors = Array.from(drawing.getElementsByTagName('wp:anchor'));
    for (const anchor of anchors) {
      anchor.setAttribute('behindDoc', '0');
      anchor.setAttribute('simplePos', '0');
      anchor.removeAttribute('relativeHeight');
      changed = true;
    }

    // Ensure the parent paragraph of the signature drawing has clean, non-overlapping line spacing
    let p = drawing.parentNode;
    while (p && p.nodeName !== 'w:p') p = p.parentNode;
    if (p) {
      let pPr = Array.from(p.childNodes).find(n => n.nodeName === 'w:pPr');
      if (!pPr) {
        pPr = doc.createElement('w:pPr');
        p.insertBefore(pPr, p.firstChild);
      }
      let spacing = Array.from(pPr.childNodes).find(n => n.nodeName === 'w:spacing');
      if (!spacing) {
        spacing = doc.createElement('w:spacing');
        pPr.appendChild(spacing);
      }
      spacing.setAttribute('w:before', '0');
      spacing.setAttribute('w:after', '0');
      spacing.setAttribute('w:line', '320');
      spacing.setAttribute('w:lineRule', 'atLeast');
      changed = true;
    }
  }

  // 2. Clear absolute positioning styles from legacy VML picture shapes (v:shape)
  const vShapes = Array.from(doc.getElementsByTagName('v:shape'));
  for (const shape of vShapes) {
    const extents = Array.from(shape.getElementsByTagName('wp:extent'));
    const isQr = extents.some(e => e.getAttribute('cx') === '762000' && e.getAttribute('cy') === '762000');
    if (isQr) continue;

    const style = shape.getAttribute('style') || '';
    if (style.includes('position:absolute')) {
      const cleanStyle = style
        .replace(/position:absolute;?/, 'position:relative;')
        .replace(/margin-top:[^;]+;?/, 'margin-top:0pt;')
        .replace(/margin-left:[^;]+;?/, 'margin-left:0pt;');
      shape.setAttribute('style', cleanStyle);
      changed = true;
    }
  }

  return changed;
}

async function runTest() {
  const docxModule = await import('./dist/services/docxService.js');
  const officeModule = await import('./dist/services/officeConversionService.js');

  const eSigDir = path.resolve('uploads', 'e-signatures');
  const files = fs.readdirSync(eSigDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  const sampleSigFile = `/uploads/e-signatures/${files[0]}`;

  const sampleCaseData = {
    caseNumber: 'CS-2026-00001',
    assistanceType: 'medicine',
    dateOfAssessment: new Date(),
    client: {
      firstName: 'JUAN',
      lastName: 'DELA CRUZ',
      addressBarangay: 'SAN JULIAN',
      dateOfBirth: '1985-05-15',
      sex: 'Male',
      civilStatus: 'Married',
      occupation: 'Farmer',
      contactNumber: '09171234567',
    },
    presentingProblem: 'Patient needs maintenance medications for hypertension.',
    backgroundOfProblem: 'Patient has limited income.',
    assessment: 'Recommending financial assistance.',
    amount: 2944.00,
    socialWorkerName: 'GERARDO Y. FIELDAD JR.',
    preparedByPosition: 'Administrative Aide II',
    preparedBySignature: sampleSigFile,

    officialAdministratorName: 'ATTY. RECHILLE ANN A. MARIANO',
    reviewedByName: 'ATTY. RECHILLE ANN A. MARIANO',
    reviewedByTitle: 'City Administrator',
    reviewedBySignature: sampleSigFile,

    officialCswdoName: 'MARIBELLE J. ARTIENDA',
    recommendingByName: 'MARIBELLE J. ARTIENDA',
    recommendingByTitle: "City Social Welfare and Dev't. Officer",
    recommendingBySignature: sampleSigFile,

    officialCityMayorName: 'HON. RANDOLF "RANDY" V. SINGSON',
    approvedByName: 'HON. RANDOLF "RANDY" V. SINGSON',
    approvedByTitle: 'City Mayor',
    approvedBySignature: sampleSigFile,

    documentQrCode: 'https://example.com/qr',
  };

  const renderedDocx = await docxModule.generateMedicineCaseStudyDocx(sampleCaseData);

  const zip = new PizZip(renderedDocx);
  const xml = zip.file('word/document.xml').asText();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  fineTuneSignatureAlignmentOnly(doc);

  const newXml = new XMLSerializer().serializeToString(doc);
  zip.file('word/document.xml', newXml);
  const cleanDocx = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

  const outputDir = path.resolve('..', '.codex-temp', 'sig-test');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, 'test_fine_tuned.docx'), cleanDocx);

  const pdfBuf = await officeModule.convertDocxBufferToPdf(cleanDocx, 'test_fine_tuned');
  if (pdfBuf) {
    fs.writeFileSync(path.join(outputDir, 'test_fine_tuned.pdf'), pdfBuf);
    console.log('Saved test_fine_tuned.pdf, size:', pdfBuf.length);
  }
}

runTest().catch(console.error);
