// ============================================================
// API — Google Apps Script Web App
// v8.0 — CS 20열 완전 매핑, 더보기 상태필터, 이슈/재인계 정리
// ============================================================
/*
 CS 이력 최종 20열 레이아웃:
 A(0): No.(자동순번)  B(1): 병원명  C(2): 요청일자  D(3): 처리완료일
 E(4): 담당자정보(고객)  F(5): 요청유형  G(6): 요청내용(상세요약)
 H(7): 요청내용 상세  I(8): 휴런담당자  J(9): 제품명  K(10): 제품버전
 L(11): 상태  M(12): 대응방식  N(13): 처리내용(상세요약)
 O(14): 처리내용 서술형  P(15): 설치확인서(빈칸)  Q(16): 비고
 R(17): 코드분류  S(18): 고객피드백반영여부  T(19): 사진첨부URL
*/


// ── 스프레드시트 ID ──────────────────────────────────────────
var 현장관리시스템_SS_ID = '1IZ-dn_kqkjtnpMHGR3v7rBC4nWhDYKyDaA54sTeC2vQ';


// ── 정확한 시트명 (이모지 인코딩 문제 → 키워드 탐색 방식 병행) ──
var HL_SH = {
  DOMESTIC:      '🏥 제품현황_국내',
  OVERSEAS:      '🏥 제품현황_해외',
  CS:            '📋 CS이력_전체',
  RETRIEVAL:     '🌏국내회수현황_국내_해외',
  INSTALL_LOG:   '📋[F702-12] 제품설치대장',
  RETRIEVAL_LOG: '📋[F702-12] 제품설치대장_회수',
  FEEDBACK_LOG:  '📋 고객 피드백 및 불만 관리대장',
  CONTACT:       '🖼️ 병원연락처',
  RECEIPT:       '🧾 영수증_이력',
  RELEASE_CACHE: '🏷 릴리즈노트_캐시',
  STAFF:         '👥 직원목록',          // ← v6 추가
  EDIT_LOG:      '📝 수정이력',          // ← v6 추가
  NOTICE:        '공지사항 및 엔지니어 공유', // ← v9 추가
};


// ── 초기 관리자 이메일 (직원목록 시트 없을 때 폴백) ────────────
var INITIAL_ADMIN_EMAIL = 'shkim@회사.com';

// ── TE팀 직원 목록 (폴백용 — 직원목록 시트 우선) ───────────────
var 회사_STAFF = [
  { name: '김성환', email: 'shkim@회사.com' },
];


// ── 폴더 ID ─────────────────────────────────────────────────
var PHOTO_FOLDER_ID         = '1AcQxGvjJlyITS4KQwoVWbx-o64sr-wiw';
var QGUIDE_FOLDER_ID        = '1fl1B3P0FjSYvQZgoKxR01GLqJYSCqPwj';
var UPDATE_MANUAL_FOLDER_ID = '1tc7hLd7MkRwdxKg9xmdo6hTwBM7aG2jR';
var RECEIPT_ROOT_FOLDER_ID  = '';


// ── Confluence 설정 ──────────────────────────────────────────
var CONFLUENCE_BASE_URL = 'https://회사.atlassian.net';
var CONFLUENCE_EMAIL    = 'shkim@회사.com';
var CONFLUENCE_TOKEN    = 'ATATT3xFfGF0oflH6RtXTkbaLsPl3yTVx4fuJyBKNnUg1mQC_EzrW19cNq-z9iO0rkiP8oxqFweiz_T7cnyVvQG4ZK-MlgEk40H0X3bkeutdhF4csgVRq-iQyZc-9Nj-aFBCb1IEpw7uRZJD6eCETBa1l-k7676OQus3AyzZXqtld3XyiZdatrU=62B41899';
var CONFLUENCE_SPACE    = 'release';


// ── 시트 제품명 → Confluence 제품명 매핑 ─────────────────────
// 시트에는 짧은 코드(ST, AD, CTP...)를 쓰고
// Confluence 페이지 제목은 "제품명", "제품명" 등을 사용
var PRODUCT_ALIAS = {
  '제품1':     '제품1',
 
};


// ──────────────────────────────────────────────────────────────
// 공통 응답 헬퍼
// ──────────────────────────────────────────────────────────────
function _ok_(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _err_(msg) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ──────────────────────────────────────────────────────────────
// doGet — GET 요청 처리
// ──────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const p      = e.parameter || {};
    const action = p.action || '';

    if (action === 'ping')                  return _ok_('pong');
    if (action === 'getHospitalList')       return handleGetHospitalList(p);
    if (action === 'getHospitalDetail')     return handleGetHospitalDetail(p);
    if (action === 'searchHospital')        return handleSearchHospital(p);
    if (action === 'getProductList')        return handleGetProductList(p);
    if (action === 'getDemoList')           return handleGetDemoList();
    if (action === 'getDomesticList')        return handleGetDomesticList(p);
    if (action === 'getMyIssues')           return handleGetMyIssues(p);
    if (action === 'getStaffList')          return handleGetStaffList();
    if (action === 'getQuickGuides')        return handleGetQuickGuides();
    if (action === 'getUpdateManuals')      return handleGetUpdateManuals();
    if (action === 'getReceipts')           return handleGetReceipts(p);
    if (action === 'getReleaseNotes')       return handleGetReleaseNotes();
    if (action === 'updateReleaseCache')    return handleUpdateReleaseCache();
    // ── v6 추가 ──
    if (action === 'getOrRegisterStaff')    return handleGetOrRegisterStaff(p);
    if (action === 'getMyHistory')          return handleGetMyHistory(p);
    if (action === 'getEditCount')          return handleGetEditCount(p);
    // ── v7 추가 ──
    if (action === 'getCSHistory')          return handleGetCSHistory(p);
    if (action === 'getNotices')            return handleGetNotices(p);
    // ── v12 추가 기능 ──
    if (action === 'getServiceReports')     return handleGetServiceReports(p);

    return _err_('Unknown action: ' + action);
  } catch (err) {
    return _err_(err.message);
  }
}


// ──────────────────────────────────────────────────────────────
// doPost — POST 요청 처리
// ──────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action || '';

    if (action === 'submitCS')           return handleSubmitCS(payload);
    if (action === 'createIssue')        return handleCreateIssue(payload);
    if (action === 'addContact')         return handleAddContact(payload);
    if (action === 'registerDemo')       return handleRegisterDemo(payload);
    if (action === 'updateLicense')      return handleUpdateLicense(payload);
    if (action === 'updateProduct')      return handleUpdateProduct(payload);
    if (action === 'withdrawDemo')       return handleWithdrawDemo(payload);
    if (action === 'completeIssue')      return handleCompleteIssue(payload);
    if (action === 'delegateIssue')      return handleDelegateIssue(payload);
    if (action === 'uploadPhoto')        return handleUploadPhoto(payload);
    if (action === 'uploadReceipt')      return handleUploadReceipt(payload);
    if (action === 'generateReceiptPDF') return handleGenerateReceiptPDF(payload);
    if (action === 'deleteReceipt')      return handleDeleteReceipt(payload);
    // ── v6 추가 ──
    if (action === 'updateCSRecord')     return handleUpdateCSRecord(payload);
    if (action === 'deleteCSRecord')     return handleDeleteCSRecord(payload);
    if (action === 'updateDemoRecord')   return handleUpdateDemoRecord(payload);
    if (action === 'updateDomesticRow')  return handleUpdateDomesticRow(payload);
    if (action === 'deleteDomesticRow')  return handleDeleteDomesticRow(payload);
    // ── v7 추가 ──
    if (action === 'updateCSStatus')     return handleUpdateCSStatus(payload);
    // ── v12 추가 기능 ──
    if (action === 'replacePhoto')             return handleReplacePhoto(payload);
    if (action === 'createServiceReport')      return handleCreateServiceReport(payload);
    if (action === 'generateServiceReportPDF') return handleGenerateServiceReportPDF(payload);
    if (action === 'sendServiceReportEmail')   return handleSendServiceReportEmail(payload);
    if (action === 'createInstallRequest')       return handleCreateInstallRequest(payload);
    if (action === 'generateInstallRequestPDF')  return handleGenerateInstallRequestPDF(payload);
    if (action === 'createQualificationReport')  return handleCreateQualificationReport(payload);
    if (action === 'generateQualificationPDF')   return handleGenerateQualificationPDF(payload);
    if (action === 'saveInstallDraft')           return handleSaveInstallDraft(payload);
    if (action === 'getInstallDrafts')           return handleGetInstallDrafts(payload);
    if (action === 'continueInstallRequest')     return handleContinueInstallRequest(payload);

    return _err_('Unknown action: ' + action);
  } catch (err) {
    return _err_(err.message);
  }
}


// ──────────────────────────────────────────────────────────────
// 공통 유틸 — 시트 탐색 (이모지 인코딩 무관)
// ──────────────────────────────────────────────────────────────
function _getSheetByKeyword_(ss, keyword) {
  // 1) 정확한 이름 시도
  var sh = ss.getSheetByName(keyword);
  if (sh) return sh;
  // 2) 모든 시트에서 키워드 포함 여부 탐색
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().indexOf(keyword) >= 0) return sheets[i];
  }
  return null;
}

function _getDomesticSheet_(ss) {
  var sh = ss.getSheetByName(HL_SH.DOMESTIC);
  if (sh) return sh;
  return _getSheetByKeyword_(ss, '제품현황_국내');
}

function _getOverseasSheet_(ss) {
  var sh = ss.getSheetByName(HL_SH.OVERSEAS);
  if (sh) return sh;
  return _getSheetByKeyword_(ss, '제품현황_해외');
}

function _getContactSheet_(ss) {
  var sh = ss.getSheetByName(HL_SH.CONTACT);
  if (sh) return sh;
  return _getSheetByKeyword_(ss, '연락처');
}

function _getReleaseCacheSheet_(ss) {
  var sh = ss.getSheetByName(HL_SH.RELEASE_CACHE);
  if (sh) return sh;
  return _getSheetByKeyword_(ss, '릴리즈노트_캐시');
}


// ── 날짜 포맷 ──────────────────────────────────────────────────
function _fmtDate_(val) {
  if (val instanceof Date && !isNaN(val)) {
    return Utilities.formatDate(val, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  return val ? String(val).trim() : '';
}

// ── 만료 상태 계산 ──────────────────────────────────────────────
function _calcStatus_(expStr, licType) {
  var statusStr = '정상';
  if (expStr) {
    var today = new Date();
    var expDt = new Date(expStr);
    var diff  = Math.ceil((expDt - today) / (1000 * 60 * 60 * 24));
    if (diff < 0)        statusStr = '만료';
    else if (diff <= 30) statusStr = '만료예정';
    else                 statusStr = '정상';
  }
  if (licType && (licType.indexOf('데모') >= 0 || licType.toLowerCase().indexOf('demo') >= 0)) {
    statusStr = '데모';
  }
  return statusStr;
}

// ── 설치유형 → 필터 카테고리 ───────────────────────────────────
function _classifyInstType_(instType) {
  var t = String(instType || '').trim();
  if (t === '납품')     return '정상';
  if (t === '과제')     return '과제';
  if (t.indexOf('데모') >= 0) return '데모';
  if (t === '임상시청') return '임상시청';
  if (t === '남풍')     return '납품';
  return '기타';
}

// ── 릴리즈 캐시 맵 빌드 (시트 → { confluenceProd: {version, pageUrl, date} }) ─
function _buildReleaseMap_(ss) {
  var cacheSheet = _getReleaseCacheSheet_(ss);
  if (!cacheSheet || cacheSheet.getLastRow() < 2) return {};
  var rows = cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, 5).getValues();
  var map = {};
  for (var i = 0; i < rows.length; i++) {
    var prod = String(rows[i][0] || '').trim();
    if (!prod) continue;
    map[prod] = {
      version: String(rows[i][1] || '').trim(),
      date:    String(rows[i][2] || '').trim(),
      pageUrl: String(rows[i][3] || '').trim(),
      category: String(rows[i][4] || '').trim(),
    };
  }
  return map;
}

// ── 시트 제품명으로 최신 버전 정보 조회 ─────────────────────────
function _lookupLatestVersion_(sheetProdName, releaseMap) {
  if (!sheetProdName || Object.keys(releaseMap).length === 0) return null;
  var name = sheetProdName.trim();

  // 1) 직접 매핑 테이블 사용
  var confName = PRODUCT_ALIAS[name];
  if (confName && releaseMap[confName]) return releaseMap[confName];

  // 2) 대소문자 무시 직접 비교
  var nameLower = name.toLowerCase();
  for (var key in releaseMap) {
    if (key.toLowerCase() === nameLower) return releaseMap[key];
  }

  // 3) Confluence 제품명에 시트 제품명 포함 여부 (예: "AD" in "회사 AD")
  for (var k in releaseMap) {
    var kl = k.toLowerCase().replace('회사 ', '').trim();
    if (kl === nameLower) return releaseMap[k];
  }

  return null;
}


// ──────────────────────────────────────────────────────────────
// [1] 병원 조회 — 국내/해외 통합
// ──────────────────────────────────────────────────────────────
function handleGetHospitalList(params) {
  var region   = String((params && params.region) || 'domestic').trim().toLowerCase();
  var ss       = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh       = (region === 'overseas') ? _getOverseasSheet_(ss) : _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: ' + (region === 'overseas' ? '제품현황_해외' : '제품현황_국내'));

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _ok_([]);

  var colCount = (region === 'overseas') ? 18 : 21;
  var data     = sh.getRange(3, 1, lastRow - 2, colCount).getValues();

  // 릴리즈 캐시 맵 로드 (최신버전 표시용)
  var releaseMap = _buildReleaseMap_(ss);

  var hospitalMap = {};

  for (var i = 0; i < data.length; i++) {
    var row  = data[i];
    var site = String(row[2] || '').trim();
    if (!site) continue;

    var regionVal, prod, ver, licType, instType, prodType, expStr, mgmtCode, manager;

    if (region === 'overseas') {
      regionVal = String(row[1]  || '').trim();
      instType  = String(row[3]  || '').trim();
      prodType  = String(row[5]  || '').trim();
      prod      = String(row[6]  || '').trim();
      ver       = String(row[8]  || '').trim();
      licType   = String(row[9]  || '').trim();
      expStr    = _fmtDate_(row[10]);
      mgmtCode  = String(row[17] || '').trim();
      manager   = String(row[13] || '').trim();
    } else {
      regionVal = String(row[1]  || '').trim();
      instType  = String(row[3]  || '').trim();
      prodType  = String(row[5]  || '').trim();
      prod      = String(row[6]  || '').trim();
      ver       = String(row[7]  || '').trim();
      licType   = String(row[8]  || '').trim();
      expStr    = _fmtDate_(row[10]);
      manager   = String(row[11] || '').trim();
      mgmtCode  = String(row[20] || '').trim();
    }

    var statusStr = _calcStatus_(expStr, licType);
    var filterCat = _classifyInstType_(instType);

    // 최신 버전 조회
    var latestInfo   = _lookupLatestVersion_(prod, releaseMap);
    var latestVer    = latestInfo ? latestInfo.version : '';
    var latestUrl    = latestInfo ? latestInfo.pageUrl  : '';

    if (!hospitalMap[site]) {
      hospitalMap[site] = {
        hospitalName: site,
        region:       regionVal,
        manager:      manager,
        isOverseas:   (region === 'overseas'),
        products:     [],
      };
    }
    if (prod) {
      hospitalMap[site].products.push({
        제품명:    prod,
        버전:      ver,
        라이선스:  licType,
        만료일:    expStr,
        상태:      statusStr,
        설치유형:  instType,
        제품유형:  prodType,
        필터분류:  filterCat,
        설치장소:  (region === 'overseas') ? String(row[14] || '').trim() : String(row[17] || '').trim(),
        관리코드:  mgmtCode,
        최신버전:  latestVer,
        최신버전URL: latestUrl,
      });
    }
  }

  var result = Object.values(hospitalMap).sort(function(a, b) {
    return a.hospitalName.localeCompare(b.hospitalName, 'ko');
  });

  return _ok_(result);
}


function handleGetHospitalDetail(params) {
  var hospitalName = String((params && params.hospitalName) || '').trim();
  var region       = String((params && params.region) || 'domestic').trim().toLowerCase();
  if (!hospitalName) return _err_('hospitalName 필수');

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = (region === 'overseas') ? _getOverseasSheet_(ss) : _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: ' + (region === 'overseas' ? '제품현황_해외' : '제품현황_국내'));

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _ok_(null);

  var colCount = (region === 'overseas') ? 26 : 27;
  var data     = sh.getRange(3, 1, lastRow - 2, colCount).getValues();

  // 릴리즈 캐시 맵 로드
  var releaseMap = _buildReleaseMap_(ss);

  var products = [];

  for (var i = 0; i < data.length; i++) {
    var row  = data[i];
    var site = String(row[2] || '').trim();
    if (site !== hospitalName) continue;

    var prod, ver, licType, instType, prodType, expStr, firstStr, ip, remote, remoteNum;
    var manager, custManager, custContact, location, mgmtCode;

    if (region === 'overseas') {
      instType    = String(row[3]  || '').trim();
      prodType    = String(row[5]  || '').trim();
      prod        = String(row[6]  || '').trim();
      firstStr    = _fmtDate_(row[7]);
      ver         = String(row[8]  || '').trim();
      licType     = String(row[9]  || '').trim();
      expStr      = _fmtDate_(row[10]);
      manager     = String(row[13] || '').trim();
      location    = String(row[14] || '').trim();
      remote      = String(row[16] || '').trim();
      mgmtCode    = String(row[17] || '').trim();
      ip          = '';
      remoteNum   = '';
      custManager = '';
      custContact = '';
    } else {
      instType    = String(row[3]  || '').trim();
      prodType    = String(row[5]  || '').trim();
      prod        = String(row[6]  || '').trim();
      ver         = String(row[7]  || '').trim();
      licType     = String(row[8]  || '').trim();
      firstStr    = _fmtDate_(row[9]);
      expStr      = _fmtDate_(row[10]);
      manager     = String(row[11] || '').trim();
      ip          = String(row[12] || '').trim();
      remote      = String(row[13] || '').trim();
      custManager = String(row[15] || '').trim();
      custContact = String(row[16] || '').trim();
      location    = String(row[17] || '').trim();
      mgmtCode    = String(row[20] || '').trim();
      remoteNum   = String(row[25] || '').trim();
    }

    var statusStr = _calcStatus_(expStr, licType);
    var filterCat = _classifyInstType_(instType);

    // 최신 버전 조회
    var latestInfo = _lookupLatestVersion_(prod, releaseMap);
    var latestVer  = latestInfo ? latestInfo.version : '';
    var latestUrl  = latestInfo ? latestInfo.pageUrl  : '';

    products.push({
      제품명:     prod,
      버전:       ver,
      라이선스:   licType,
      설치일:     firstStr,
      만료일:     expStr,
      상태:       statusStr,
      설치유형:   instType,
      제품유형:   prodType,
      필터분류:   filterCat,
      IP:         ip,
      원격:       remote,
      원격번호:   remoteNum,
      담당자:     manager,
      고객담당자: custManager,
      연락처:     custContact,
      설치장소:   location,
      지역:       String(row[1] || '').trim(),
      관리코드:   mgmtCode,
      최신버전:   latestVer,
      최신버전URL: latestUrl,
    });
  }

  // CS 이력 최근 10건 (20열 기준)
  var csSheet   = ss.getSheetByName(HL_SH.CS);
  var csHistory = [];
  if (csSheet) {
    var csLastRow = csSheet.getLastRow();
    if (csLastRow >= 3) {
      var csData = csSheet.getRange(3, 1, csLastRow - 2, 20).getValues();
      for (var j = 0; j < csData.length; j++) {
        var cr = csData[j];
        if (String(cr[1] || '').trim() !== hospitalName) continue;
        var rdStr     = _fmtDate_(cr[2]);
        var photoRaw  = String(cr[19] || '').trim();   // T(19): 사진첨부URL
        var photoUrls = [];
        if (photoRaw) {
          try {
            var parsed = JSON.parse(photoRaw);
            photoUrls = Array.isArray(parsed) ? parsed : [photoRaw];
          } catch(e) {
            photoUrls = photoRaw.split(',').map(function(u){ return u.trim(); }).filter(Boolean);
          }
        }
        csHistory.push({
          rowIndex:       j + 3,
          접수일시:       rdStr,
          처리완료일:     _fmtDate_(cr[3]),                // D(3)
          요청유형:       String(cr[5]  || '').trim(),     // F(5)
          접수내용:       String(cr[6]  || '').trim(),     // G(6)
          처리및조치사항: String(cr[13] || '').trim(),     // N(13) 처리내용(상세요약)
          담당자:         String(cr[8]  || '').trim(),     // I(8)
          제품명:         String(cr[9]  || '').trim(),     // J(9)
          버전:           String(cr[10] || '').trim(),     // K(10) 제품버전 ← v11.1 추가
          csStatus:       String(cr[11] || '접수').trim(), // L(11) 상태 — 프론트 키 통일
          대응방식:       String(cr[12] || '').trim(),     // M(12)
          처리내용서술형: String(cr[14] || '').trim(),     // O(14) 처리내용 서술형
          비고:           String(cr[16] || '').trim(),     // Q(16) 비고
          사진URL:        photoUrls,
        });
      }
      csHistory.sort(function(a, b) { return b.접수일시.localeCompare(a.접수일시); });
      // ① 10개 제한 제거 — 전체 이력 반환
    }
  }

  // 연락처 — 키워드 탐색 (1행=헤더 스킵, 2행~)
  var contactSheet = _getContactSheet_(ss);
  var contacts = [];
  if (contactSheet) {
    var ctLastRow = contactSheet.getLastRow();
    if (ctLastRow >= 2) {
      var ctData = contactSheet.getRange(2, 1, ctLastRow - 1, 4).getValues(); // ③ 헤더(1행) 스킵
      for (var k = 0; k < ctData.length; k++) {
        var ct = ctData[k];
        if (String(ct[0] || '').trim() !== hospitalName) continue;
        var ctName = String(ct[1] || '').trim();
        if (!ctName) continue;
        contacts.push({
          이름:   ctName,
          부서:   String(ct[2] || '').trim(),
          연락처: String(ct[3] || '').trim(),
        });
      }
    }
  }

  return _ok_({
    hospitalName: hospitalName,
    isOverseas:   (region === 'overseas'),
    products:     products,
    csHistory:    csHistory,
    contacts:     contacts,
  });
}


function handleSearchHospital(params) {
  var keyword = String((params && params.keyword) || '').trim();
  var region  = String((params && params.region)  || 'domestic').trim().toLowerCase();
  if (!keyword) return _ok_([]);

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = (region === 'overseas') ? _getOverseasSheet_(ss) : _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음');

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _ok_([]);

  var data   = sh.getRange(3, 1, lastRow - 2, 3).getValues();
  var seen   = {};
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var site = String(data[i][2] || '').trim();
    if (!site || seen[site]) continue;
    if (site.indexOf(keyword) < 0) continue;
    seen[site] = true;
    result.push({ hospitalName: site, region: String(data[i][1] || '').trim() });
    if (result.length >= 20) break;
  }

  return _ok_(result);
}


function handleGetProductList(params) {
  var hospitalName = String((params && params.hospitalName) || '').trim();
  var region       = String((params && params.region)       || 'domestic').trim().toLowerCase();
  if (!hospitalName) return _err_('hospitalName 필수');

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = (region === 'overseas') ? _getOverseasSheet_(ss) : _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음');

  var lastRow  = sh.getLastRow();
  if (lastRow < 3) return _ok_([]);

  var data     = sh.getRange(3, 1, lastRow - 2, 7).getValues();
  var products = [];

  for (var i = 0; i < data.length; i++) {
    if (String(data[i][2] || '').trim() !== hospitalName) continue;
    var prod = String(data[i][6] || '').trim();
    if (prod) products.push(prod);
  }

  return _ok_(products);
}


// ──────────────────────────────────────────────────────────────
// [2] CS 등록
// ──────────────────────────────────────────────────────────────
function handleSubmitCS(payload) {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('시트 없음: ' + HL_SH.CS);

  var now = new Date();

  // 요청일자: 프론트에서 reqDate로 전달 (없으면 오늘)
  var reqDate = payload.reqDate ? new Date(payload.reqDate) : now;

  // 처리완료일: 완료 상태일 때만
  var csStatus = String(payload.csStatus || '접수').trim();
  var doneDate = '';
  if (csStatus === '완료') {
    doneDate = payload.doneDate ? new Date(payload.doneDate) : now;
  }

  // 사진 URL 조합
  var photoUrls = (payload.photoUrls || []).join(', ');

  // 빈 행 무시하고 실제 마지막 데이터 행 찾기 (B열=병원명 기준)
  var totalRow = sh.getLastRow();
  var actualLastDataRow = 2;
  if (totalRow >= 3) {
    var colB = sh.getRange(3, 2, totalRow - 2, 1).getValues();
    for (var r = colB.length - 1; r >= 0; r--) {
      if (String(colB[r][0] || '').trim() !== '') {
        actualLastDataRow = r + 3;
        break;
      }
    }
  }
  var newRow = actualLastDataRow + 1;
  var seq    = Math.max(0, actualLastDataRow - 2) + 1;

  // ── 필드 파싱 ──────────────────────────────────────────────
  // 요청유형: requestType(프론트) 또는 csType(레거시)
  var requestType = String(payload.requestType || payload.csType || '기타').trim();

  // 요청내용 상세요약: description(프론트) 또는 content(레거시)
  var description = String(payload.description || payload.content || '').trim();

  // 요청내용 상세 (서술형): descriptionDetail
  var descriptionDetail = String(payload.descriptionDetail || '').trim();

  // 제품명: 코드분류(codeType) 기반 자동변환 → 없으면 productName 직접
  var codeType    = String(payload.codeType || '').trim();
  var rawProduct  = String(payload.productName || '').trim();
  var productName = '';
  if (codeType && PRODUCT_ALIAS[codeType]) {
    productName = PRODUCT_ALIAS[codeType];
  } else if (PRODUCT_ALIAS[rawProduct]) {
    productName = PRODUCT_ALIAS[rawProduct];
  } else {
    productName = rawProduct;
  }

  // 제품버전: 공백 자동 제거
  var version = String(payload.version || payload.productVersion || '').replace(/\s+/g, '');

  // 휴런담당자: handlerName (로그인 이름 자동)
  var handlerName = String(payload.handlerName || '').trim();

  // 담당자정보(고객): custInfo 또는 newContact 조합
  var custInfo = String(payload.custInfo || '').trim();
  if (!custInfo && payload.newContact) {
    var nc = payload.newContact;
    var parts = [];
    if (nc.name)       parts.push(String(nc.name).trim());
    if (nc.department) parts.push(String(nc.department).trim());
    if (nc.phone)      parts.push(String(nc.phone).trim());
    custInfo = parts.join('/');
  }

  // 대응방식: responseMethod (원격/유선/방문)
  var responseMethod = String(payload.responseMethod || '').trim();

  // 처리내용 상세요약: actionSummary 또는 actionTaken(레거시)
  var actionSummary = String(payload.actionSummary || payload.actionTaken || payload.processDetail || '').trim();

  // 처리내용 서술형: actionDetail
  var actionDetail = String(payload.actionDetail || '').trim();

  // 비고: remarks
  var remarks = String(payload.remarks || '').trim();

  // 고객 피드백 반영 여부: feedbackApplied (기본: 미반영)
  var feedbackApplied = String(payload.feedbackApplied || '미반영').trim();

  // ── 20열 rowData ───────────────────────────────────────────
  var rowData = [
    seq,            // A(0):  No. (자동순번)
    String(payload.hospitalName || '').trim(), // B(1):  병원명
    reqDate,        // C(2):  요청일자
    doneDate || '', // D(3):  처리완료일
    custInfo,       // E(4):  담당자정보(고객)
    requestType,    // F(5):  요청유형
    description,    // G(6):  요청내용(상세요약)
    descriptionDetail, // H(7): 요청내용 상세
    handlerName,    // I(8):  휴런담당자
    productName,    // J(9):  제품명
    version,        // K(10): 제품버전
    csStatus,       // L(11): 상태
    responseMethod, // M(12): 대응방식
    actionSummary,  // N(13): 처리내용(상세요약)
    actionDetail,   // O(14): 처리내용 서술형
    '',             // P(15): 설치확인서 (빈칸)
    remarks,        // Q(16): 비고
    codeType,       // R(17): 코드분류
    feedbackApplied, // S(18): 고객 피드백 반영 여부
    photoUrls,      // T(19): 사진첨부 URL
  ];

  sh.getRange(newRow, 1, 1, 20).setValues([rowData]);
  sh.getRange(newRow, 3).setNumberFormat('yyyy-MM-dd');
  if (doneDate) sh.getRange(newRow, 4).setNumberFormat('yyyy-MM-dd');
  SpreadsheetApp.flush();

  // ── 구글 캘린더 자동 등록 (v11) ──────────────────────────
  _registerToCalendar_(payload, newRow);

  return _ok_({ rowIndex: newRow });
}


function handleCreateIssue(payload) {
  var ss      = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh      = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('시트 없음: ' + HL_SH.CS);

  var now      = new Date();
  var hospital = String(payload.hospitalName  || '').trim();
  var product  = String(payload.productName   || '').trim();
  var plan     = String(payload.followUpPlan  || '').trim();
  var dueDate  = payload.dueDate ? new Date(payload.dueDate) : '';
  var assignee = String(payload.assigneeEmail || '').trim();

  var lastRow  = sh.getLastRow();
  var newRow   = lastRow + 1;
  var seq      = Math.max(0, lastRow - 2) + 1;

  var rowData  = [
    seq, hospital, now, dueDate || '',
    '', '이슈', plan, '',
    assignee, product,
    '', '', '', '',
    '', '', '', '',
    '미완료', assignee,
  ];

  sh.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
  sh.getRange(newRow, 3).setNumberFormat('yyyy-MM-dd');
  if (dueDate) sh.getRange(newRow, 4).setNumberFormat('yyyy-MM-dd');
  SpreadsheetApp.flush();

  if (assignee && assignee.indexOf('@') > 0) {
    try {
      var dueDateStr = dueDate instanceof Date ? Utilities.formatDate(dueDate, 'Asia/Seoul', 'yyyy-MM-dd') : '';
      MailApp.sendEmail({
        to: assignee,
        subject: '[현장관리시스템] 새 이슈 배정 — ' + hospital,
        htmlBody: '<p>새 이슈가 배정되었습니다.</p>' +
          '<p><b>병원:</b> ' + hospital + '</p>' +
          '<p><b>제품:</b> ' + product + '</p>' +
          '<p><b>내용:</b> ' + plan + '</p>' +
          '<p><b>기한:</b> ' + dueDateStr + '</p>',
      });
    } catch (mailErr) { Logger.log('[이슈 이메일 오류] ' + mailErr.message); }
  }

  return _ok_({ rowIndex: newRow });
}


function handleAddContact(payload) {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getContactSheet_(ss);
  if (!sh) return _ok_({ skipped: true, reason: '병원연락처 시트 없음' });

  var lastRow = sh.getLastRow() + 1;
  sh.getRange(lastRow, 1, 1, 4).setValues([[
    String(payload.hospitalName || '').trim(),
    String(payload.name         || '').trim(),
    String(payload.department   || '').trim(),
    String(payload.phone        || '').trim(),
  ]]);
  SpreadsheetApp.flush();
  return _ok_({ rowIndex: lastRow });
}


// ──────────────────────────────────────────────────────────────
// [3] 신규 데모 등록
// ──────────────────────────────────────────────────────────────
function handleRegisterDemo(payload) {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: 제품현황_국내');

  // ── 기본 필드 파싱 ──────────────────────────────────────────
  var hospital      = String(payload.hospitalName      || '').trim();   // C(2)
  var region        = String(payload.region            || '').trim();   // B(1): 행정구분
  var installType   = String(payload.installType       || '').trim();   // D(3): 설치유형
  var contractType  = String(payload.contractType      || '').trim();   // E(4): 계약유형
  var productType   = String(payload.productType       || '').trim();   // F(5): 제품유형
  var product       = String(payload.productName       || '').trim();   // G(6): 제품명
  var version       = String(payload.version           || '').trim();   // H(7): 버전
  var licType       = String(payload.licenseType       || '데모').trim(); // I(8): 라이선스유형
  var instDate      = payload.installDate ? new Date(payload.installDate) : new Date(); // J(9): 최초설치날짜
  var expiryDate    = payload.expiryDate  ? new Date(payload.expiryDate)  : '';         // K(10): 라이선스만료일
  var handler       = String(payload.handlerName       || '').trim();   // L(11): 주담당자
  var ip            = String(payload.ip                || '').trim();   // M(12): IP주소
  var linkMethod    = String(payload.linkMethod        || '').trim();   // N(13): 연동방식
  var deviceMaker   = String(payload.deviceMaker       || '').trim();   // O(14): 장비제조사
  var linkDetail    = String(payload.linkDetail        || '').trim();   // P(15): 상세연동내역
  var userInfo      = String(payload.userInfo          || '').trim();   // Q(16): 사용자/담당자정보
  var location      = String(payload.location          || '').trim();   // R(17): 설치장소
  var pacsVendor    = String(payload.pacsVendor        || '').trim();   // S(18): PACS업체정보
  var remoteAvail   = String(payload.remoteAvailable   || '').trim();   // T(19): 원격가능
  var mgmtCode      = String(payload.mgmtCode          || payload.pcNumber || '').trim(); // U(20): 관리코드
  var installCert   = String(payload.installCert       || '').trim();   // V(21): 설치확인서
  var memo          = String(payload.memo              || '').trim();   // W(22): 비고
  // X(23): 라이선스연장보류유무 — 숨김필드, 빈값
  // Y(24): 사유 — 숨김필드, 빈값
  var remoteNum     = String(payload.remoteNumber      || '').trim();   // Z(25): 원격번호
  var photoUrls        = (payload.photoUrls        || []).join(', ');  // AA(26): 사진첨부URL(설치확인서)
  var installPhotoUrls = (payload.installPhotoUrls || []).join(', ');  // AB(27): 설치및셋팅사진경로

  // 빈 행 무시하고 실제 마지막 데이터 행 찾기 (C열=사이트이름 기준)
  var totalRow = sh.getLastRow();
  var actualLastDataRow = 2;
  if (totalRow >= 3) {
    var colC = sh.getRange(3, 3, totalRow - 2, 1).getValues();
    for (var r = colC.length - 1; r >= 0; r--) {
      if (String(colC[r][0] || '').trim() !== '') {
        actualLastDataRow = r + 3;
        break;
      }
    }
  }
  var newRow = actualLastDataRow + 1;
  var seq    = Math.max(0, actualLastDataRow - 2) + 1;

  // ── A(0)~Z(25) + AA(26) + AB(27) = 28열 ─────────────────────
  var rowData = new Array(28).fill('');
  rowData[0]  = seq;           // A: No.
  rowData[1]  = region;        // B: 행정구분
  rowData[2]  = hospital;      // C: 사이트이름
  rowData[3]  = installType;   // D: 설치유형
  rowData[4]  = contractType;  // E: 계약유형
  rowData[5]  = productType;   // F: 제품유형
  rowData[6]  = product;       // G: 제품명
  rowData[7]  = version;       // H: 버전
  rowData[8]  = licType;       // I: 라이선스유형
  rowData[9]  = instDate;      // J: 최초설치날짜
  rowData[10] = expiryDate;    // K: 라이선스만료일
  rowData[11] = handler;       // L: 주담당자
  rowData[12] = ip;            // M: IP주소
  rowData[13] = linkMethod;    // N: 연동방식
  rowData[14] = deviceMaker;   // O: 장비제조사
  rowData[15] = linkDetail;    // P: 상세연동내역
  rowData[16] = userInfo;      // Q: 사용자/담당자정보
  rowData[17] = location;      // R: 설치장소
  rowData[18] = pacsVendor;    // S: PACS업체정보
  rowData[19] = remoteAvail;   // T: 원격가능
  rowData[20] = mgmtCode;      // U: 관리코드
  rowData[21] = installCert;   // V: 설치확인서
  rowData[22] = memo;          // W: 비고
  rowData[23] = '';            // X: 라이선스연장보류유무 (숨김)
  rowData[24] = '';            // Y: 사유 (숨김)
  rowData[25] = remoteNum;     // Z: 원격번호
  rowData[26] = photoUrls;         // AA: 사진첨부URL (설치확인서)
  rowData[27] = installPhotoUrls;  // AB: 설치및셋팅사진경로

  sh.getRange(newRow, 1, 1, 28).setValues([rowData]);
  // 날짜 포맷 지정
  if (instDate)   sh.getRange(newRow, 10).setNumberFormat('yyyy-MM-dd');
  if (expiryDate) sh.getRange(newRow, 11).setNumberFormat('yyyy-MM-dd');
  SpreadsheetApp.flush();
  return _ok_({ rowIndex: newRow });
}


// ──────────────────────────────────────────────────────────────
// [4] 업데이트
// ──────────────────────────────────────────────────────────────
function handleUpdateLicense(payload) {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: 제품현황_국내');

  var hospital  = String(payload.hospitalName || '').trim();
  var product   = String(payload.productName  || '').trim();
  var newExpiry = payload.newExpiry ? new Date(payload.newExpiry) : null;
  var months    = parseInt(payload.months, 10) || 0;
  var photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls : [];

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _err_('데이터 없음');

  var data    = sh.getRange(3, 1, lastRow - 2, 11).getValues();
  var updated = 0;

  for (var i = 0; i < data.length; i++) {
    var site = String(data[i][2] || '').trim();
    var prod = String(data[i][6] || '').trim();
    if (site !== hospital) continue;
    if (product && prod !== product && prod.indexOf(product) < 0 && product.indexOf(prod) < 0) continue;

    var rowNum = i + 3;
    var targetDate;
    if (newExpiry) {
      targetDate = newExpiry;
    } else if (months > 0) {
      var curExp = data[i][10];
      var base   = (curExp instanceof Date && !isNaN(curExp)) ? new Date(curExp) : new Date();
      base.setMonth(base.getMonth() + months);
      targetDate = base;
    }
    if (targetDate) {
      sh.getRange(rowNum, 11).setValue(targetDate).setNumberFormat('yyyy-MM-dd');
    }
    if (photoUrls.length > 0) {
      sh.getRange(rowNum, 27).setValue(JSON.stringify(photoUrls));
    }
    updated++;
  }

  SpreadsheetApp.flush();
  if (updated === 0) return _err_('해당 병원/제품 없음');
  return _ok_({ updated: updated });
}


function handleUpdateProduct(payload) {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: 제품현황_국내');

  var hospital  = String(payload.hospitalName || '').trim();
  var product   = String(payload.productName  || '').trim();
  var newVer    = String(payload.newVersion   || '').trim();
  if (!newVer) return _err_('버전 정보(newVersion) 필수');
  var photoUrls = Array.isArray(payload.photoUrls) ? payload.photoUrls : [];

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _err_('데이터 없음');

  var data    = sh.getRange(3, 1, lastRow - 2, 8).getValues();
  var updated = 0;

  for (var i = 0; i < data.length; i++) {
    var site = String(data[i][2] || '').trim();
    var prod = String(data[i][6] || '').trim();
    if (site !== hospital) continue;
    if (product && prod !== product && prod.indexOf(product) < 0 && product.indexOf(prod) < 0) continue;
    sh.getRange(i + 3, 8).setValue(newVer);
    if (photoUrls.length > 0) {
      sh.getRange(i + 3, 27).setValue(JSON.stringify(photoUrls));
    }
    updated++;
  }

  SpreadsheetApp.flush();
  if (updated === 0) return _err_('해당 병원/제품 없음');
  return _ok_({ updated: updated });
}


// ──────────────────────────────────────────────────────────────
// [5] 철수 — 데모 + 상용 만료/만료예정 포함
// ──────────────────────────────────────────────────────────────
function handleGetDemoList() {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: 제품현황_국내');

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _ok_([]);

  var data   = sh.getRange(3, 1, lastRow - 2, 21).getValues();
  var result = [];
  var today  = new Date();

  for (var i = 0; i < data.length; i++) {
    var row      = data[i];
    var site     = String(row[2] || '').trim();
    if (!site) continue;

    var instType = String(row[3] || '').trim();
    var licType  = String(row[8] || '').trim();
    var expStr   = _fmtDate_(row[10]);

    var isDemo = instType.indexOf('데모') >= 0
              || licType.indexOf('데모') >= 0
              || licType.toLowerCase().indexOf('demo') >= 0;

    var isExpiredCommercial = false;
    if (!isDemo && expStr) {
      var expDt = new Date(expStr);
      var diff  = Math.ceil((expDt - today) / (1000 * 60 * 60 * 24));
      if (diff <= 30) isExpiredCommercial = true;
    }

    if (!isDemo && !isExpiredCommercial) continue;

    result.push({
      병원명:   site,
      지역:     String(row[1]  || '').trim(),
      제품명:   String(row[6]  || '').trim(),
      버전:     String(row[7]  || '').trim(),
      라이선스: licType,
      만료일:   expStr,
      상태:     _calcStatus_(expStr, licType),
      담당자:   String(row[11] || '').trim(),
      PC번호:   String(row[20] || '').trim(),
      철수유형: isDemo ? '데모' : '상용만료',
    });
  }

  return _ok_(result);
}


function handleWithdrawDemo(payload) {
  var ss      = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh      = ss.getSheetByName(HL_SH.RETRIEVAL);
  if (!sh) return _err_('시트 없음: ' + HL_SH.RETRIEVAL);

  var hospital  = String(payload.hospitalName || '').trim();
  var product   = String(payload.productName  || '').trim();
  var reason    = String(payload.reason       || '').trim();
  var manager   = String(payload.handlerName  || '').trim();
  var mgmtCode  = String(payload.mgmtCode     || '').trim();
  var region    = String(payload.region       || '').trim();
  var retDate   = payload.retireDate ? new Date(payload.retireDate) : new Date();
  var photoUrls = (payload.photoUrls || []).join(', ');

  var lastRow = sh.getLastRow() + 1;
  var rowData = new Array(18).fill('');
  rowData[0]  = region;
  rowData[1]  = hospital;
  rowData[2]  = retDate;
  rowData[3]  = product;
  rowData[4]  = photoUrls;
  rowData[5]  = manager;
  rowData[6]  = reason;
  rowData[17] = mgmtCode;

  sh.getRange(lastRow, 1, 1, 18).setValues([rowData]);
  sh.getRange(lastRow, 3).setNumberFormat('yyyy-MM-dd');
  SpreadsheetApp.flush();
  return _ok_({ rowIndex: lastRow });
}


// ──────────────────────────────────────────────────────────────
// [6] 내 할일 (이슈)
// ──────────────────────────────────────────────────────────────
function handleGetMyIssues(params) {
  var email = String((params && params.email) || '').trim().toLowerCase();
  if (!email) return _ok_([]);

  var ss        = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var staffName = _getStaffName_(ss, email);
  var sh        = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('시트 없음: ' + HL_SH.CS);

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _ok_([]);

  var data   = sh.getRange(3, 1, lastRow - 2, 20).getValues();
  var issues = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];

    // ── CS: 휴런담당자(I열/row[8]) + 접수·진행중 상태 ──────
    var handler   = String(row[8]  || '').trim();   // I(8): 휴런담당자
    var csStatus  = String(row[11] || '').trim();   // L(11): 상태
    if (!csStatus) continue;
    if (csStatus !== '접수' && csStatus !== '진행중') continue;
    if (handler !== staffName && handler.toLowerCase() !== email) continue;

    issues.push({
      rowIndex:     i + 3,
      hospitalName: String(row[1] || '').trim(),   // B(1)
      productName:  String(row[9] || '').trim(),   // J(9)
      status:       csStatus,                       // L(11)
      reqDate:      _fmtDate_(row[2]),              // C(2)
      assigneeEmail: email,
      itemType:     'cs',
      요청유형:     String(row[5] || '').trim(),    // F(5)
      접수내용:     String(row[6] || '').trim(),    // G(6)
    });
  }

  return _ok_(issues);
}


function handleCompleteIssue(payload) {
  // v8: CS 상태를 '완료'로 변경 + 처리완료일 자동
  var rowIndex = parseInt(payload.rowIndex, 10);
  if (!rowIndex) return _err_('rowIndex 필수');
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('시트 없음');
  sh.getRange(rowIndex, 12).setValue('완료');  // L(12): 상태 → 1-indexed=12
  sh.getRange(rowIndex, 4).setValue(new Date()).setNumberFormat('yyyy-MM-dd');
  SpreadsheetApp.flush();
  return _ok_({ done: true });
}


function handleDelegateIssue(payload) {
  // v8: 이슈 타입 제거 → CS 재인계는 담당자(I열) 변경으로 처리
  var rowIndex = parseInt(payload.rowIndex, 10);
  var newEmail = String(payload.newAssigneeEmail || '').trim();
  if (!rowIndex || !newEmail) return _err_('rowIndex, newAssigneeEmail 필수');
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('시트 없음');
  // 담당자(I=9열 1-indexed) 변경
  sh.getRange(rowIndex, 9).setValue(newEmail);
  sh.getRange(rowIndex, 12).setValue('접수');  // L(12): 상태→접수로 리셋
  SpreadsheetApp.flush();
  try {
    var row = sh.getRange(rowIndex, 1, 1, 10).getValues()[0];
    MailApp.sendEmail({
      to: newEmail,
      subject: '[현장관리시스템] CS 재인계 알림 — ' + String(row[1] || ''),
      htmlBody: '<p>CS 이력이 귀하에게 재인계되었습니다.</p>' +
        '<p><b>병원:</b> ' + String(row[1] || '') + '</p>' +
        '<p><b>내용:</b> ' + String(row[6] || '') + '</p>',
    });
  } catch (e) { Logger.log(e); }
  return _ok_({ done: true });
}


function handleCreateIssue(payload) {
  // v8: 이슈 타입 없음 — CS 등록만 사용. 하위 호환용으로 유지하되 submitCS와 동일 처리
  return handleSubmitCS({
    hospitalName: payload.hospitalName,
    productName:  payload.productName,
    requestType:  '기타',
    description:  payload.followUpPlan || '',
    csStatus:     '접수',
    handlerName:  payload.assigneeEmail || '',
  });
}


// ──────────────────────────────────────────────────────────────
// [7] 사진 업로드
// ──────────────────────────────────────────────────────────────
function handleUploadPhoto(payload) {
  if (!PHOTO_FOLDER_ID) return _err_('PHOTO_FOLDER_ID 미설정');
  var base64   = payload.base64   || '';
  var fileName = payload.fileName || 'photo.jpg';
  var mimeType = payload.mimeType || 'image/jpeg';
  var category = payload.category || 'MISC';
  try {
    var folder    = DriveApp.getFolderById(PHOTO_FOLDER_ID);
    var subs      = folder.getFoldersByName(category);
    var subFolder = subs.hasNext() ? subs.next() : folder.createFolder(category);
    var blob      = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    var file      = subFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId  = file.getId();
    var fileUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    return _ok_({ fileUrl: fileUrl, fileId: fileId });
  } catch (err) {
    return _err_('업로드 오류: ' + err.message);
  }
}


// ──────────────────────────────────────────────────────────────
// [8] 직원 목록
// ──────────────────────────────────────────────────────────────
function handleGetStaffList() {
  return _ok_(회사_STAFF);
}


// ──────────────────────────────────────────────────────────────
// [9] Q가이드
// ──────────────────────────────────────────────────────────────
function handleGetQuickGuides() {
  try {
    var rootFolder = DriveApp.getFolderById(QGUIDE_FOLDER_ID);
    var subFolders = rootFolder.getFolders();
    var groups     = [];
    while (subFolders.hasNext()) {
      var sub   = subFolders.next();
      var files = sub.getFiles();
      var items = [];
      while (files.hasNext()) {
        var f = files.next();
        var mt = f.getMimeType();
        if (mt === 'application/pdf' ||
            mt === 'application/vnd.ms-powerpoint' ||
            mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            mt === 'application/vnd.google-apps.presentation') {
          items.push({ name: f.getName(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', mimeType: mt });
        }
      }
      if (items.length > 0) {
        items.sort(function(a, b) { return a.name.localeCompare(b.name, 'ko'); });
        groups.push({ folder: sub.getName(), files: items });
      }
    }
    groups.sort(function(a, b) { return a.folder.localeCompare(b.folder, 'ko'); });
    return _ok_(groups);
  } catch (err) {
    return _err_('Q가이드 조회 오류: ' + err.message);
  }
}


// ──────────────────────────────────────────────────────────────
// [10] 업데이트 메뉴얼
// ──────────────────────────────────────────────────────────────
function handleGetUpdateManuals() {
  try {
    var folder = DriveApp.getFolderById(UPDATE_MANUAL_FOLDER_ID);
    var files  = folder.getFiles();
    var items  = [];
    while (files.hasNext()) {
      var f  = files.next();
      var mt = f.getMimeType();
      if (mt === 'application/pdf' ||
          mt === 'application/vnd.ms-powerpoint' ||
          mt === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          mt === 'application/vnd.google-apps.presentation') {
        items.push({ name: f.getName(), url: 'https://drive.google.com/file/d/' + f.getId() + '/view', mimeType: mt });
      }
    }
    items.sort(function(a, b) { return a.name.localeCompare(b.name, 'ko'); });
    return _ok_(items);
  } catch (err) {
    return _err_('업데이트 메뉴얼 조회 오류: ' + err.message);
  }
}


// ──────────────────────────────────────────────────────────────
// [11] 영수증 관리
// ──────────────────────────────────────────────────────────────
function _getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function _getReceiptRootFolder_() {
  if (RECEIPT_ROOT_FOLDER_ID) { try { return DriveApp.getFolderById(RECEIPT_ROOT_FOLDER_ID); } catch(e) {} }
  return _getOrCreateFolder_(DriveApp.getRootFolder(), '현장관리시스템_영수증');
}
function _getReceiptFolder_(userName, yearMonth) {
  return _getOrCreateFolder_(_getOrCreateFolder_(_getReceiptRootFolder_(), userName), yearMonth);
}
// ── 영수증 시트 헤더 (v10 기준 13열) ──────────────────────────
// A(1):날짜 B(2):담당자 C(3):이메일 D(4):금액 E(5):메모
// F(6):분류(결제수단) G(7):하위분류(비용분류) H(8):세부분류 I(9):세부메모
// J(10):파일ID K(11):파일명 L(12):파일URL M(13):등록시각
var RECEIPT_HEADERS_V10 = ['날짜','담당자','이메일','금액','메모','분류','하위분류','세부분류','세부메모','파일ID','파일명','파일URL','등록시각'];

function _ensureReceiptSheet_() {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(HL_SH.RECEIPT);
  if (!sh) {
    // 신규 시트 생성
    sh = ss.insertSheet(HL_SH.RECEIPT);
    sh.appendRow(RECEIPT_HEADERS_V10);
    sh.setFrozenRows(1);
    return sh;
  }

  // ── 마이그레이션: 기존 10열 → 13열 ──────────────────────────
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  // G열(7번째)이 '하위분류'가 아니면 구버전 → 마이그레이션 실행
  if (lastCol < 13 || String(headers[6] || '').trim() !== '하위분류') {
    // 1. 분류(F열) 없으면 먼저 추가
    if (String(headers[5] || '').trim() !== '분류') {
      sh.insertColumnBefore(6);
      sh.getRange(1, 6).setValue('분류');
      var lastRow0 = sh.getLastRow();
      for (var i0 = 2; i0 <= lastRow0; i0++) sh.getRange(i0, 6).setValue('법인카드');
      SpreadsheetApp.flush();
      // 헤더 재조회
      headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    }
    // 2. F열(분류) 바로 뒤에 3열 삽입 → G=하위분류, H=세부분류, I=세부메모
    sh.insertColumnsAfter(6, 3);
    sh.getRange(1, 7).setValue('하위분류');
    sh.getRange(1, 8).setValue('세부분류');
    sh.getRange(1, 9).setValue('세부메모');
    // 기존 데이터는 빈값으로 유지 (J~M으로 밀림)
    SpreadsheetApp.flush();
    // 헤더 재조회
    headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  }

  // ── 더미 J열 제거: J열(10번째) 헤더가 비어있고 파일ID가 K열(11번째)에 있는 경우 ──
  // (열 삽입 마이그레이션 후 J열에 더미 데이터가 남아있는 케이스 자동 정리)
  var curHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var jHeader = String(curHeaders[9] || '').trim();   // J열(index 9)
  var kHeader = String(curHeaders[10] || '').trim();  // K열(index 10)
  if (jHeader === '' && kHeader === '파일ID') {
    sh.deleteColumn(10); // 빈 헤더의 더미 J열 삭제
    SpreadsheetApp.flush();
  }

  return sh;
}
function _nameByEmail_(email) {
  for (var i = 0; i < 회사_STAFF.length; i++) {
    if (회사_STAFF[i].email === email) return 회사_STAFF[i].name;
  }
  return email.split('@')[0];
}

function handleUploadReceipt(payload) {
  try {
    var email       = String(payload.email      || '').trim();
    var date        = String(payload.date       || Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'));
    var amount      = String(payload.amount     || '');
    var memo        = String(payload.memo       || '');         // E열: 일반 메모
    var payMethod   = String(payload.payMethod  || '법인카드'); // F열: 결제수단
    var subCat1     = String(payload.subCat1    || '');         // G열: 하위분류
    var subCat2     = String(payload.subCat2    || '');         // H열: 세부분류
    var detailMemo  = String(payload.detailMemo || '');         // I열: 세부메모
    var fileName    = String(payload.fileName   || ('receipt_' + date + '.jpg'));
    var mimeType    = String(payload.mimeType   || 'image/jpeg');
    var b64         = payload.fileBase64;
    if (!b64) return _err_('파일 데이터 없음');

    var userName  = _nameByEmail_(email);
    var yearMonth = date.slice(0, 7);
    var folder    = _getReceiptFolder_(userName, yearMonth);
    var blob      = Utilities.newBlob(Utilities.base64Decode(b64), mimeType, fileName);
    var file      = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId  = file.getId();
    var fileUrl = 'https://drive.google.com/file/d/' + fileId + '/view';

    var sh = _ensureReceiptSheet_();
    // 13열 저장: A~E, F분류, G하위분류, H세부분류, I세부메모, J파일ID, K파일명, L파일URL, M등록시각
    sh.appendRow([
      date, userName, email, amount, memo,
      payMethod, subCat1, subCat2, detailMemo,
      fileId, fileName, fileUrl,
      Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
    ]);
    SpreadsheetApp.flush();
    return _ok_({ fileId: fileId, fileUrl: fileUrl });
  } catch (e) { return _err_('영수증 업로드 실패: ' + e.message); }
}

function handleGetReceipts(params) {
  try {
    var email     = String((params && params.email)     || '').trim();
    var yearMonth = String((params && params.yearMonth) || '').trim();
    var sh   = _ensureReceiptSheet_();
    var data = sh.getDataRange().getValues();
    if (data.length <= 1) return _ok_([]);
    var results = [];
    for (var i = 1; i < data.length; i++) {
      var row     = data[i];
      var rawDate = row[0];
      var rowDate = '';
      if (rawDate instanceof Date) {
        rowDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else {
        rowDate = String(rawDate || '').slice(0, 10);
      }
      if (!rowDate) continue;
      // v11.3: 이메일 대소문자 무관 비교, email 없으면 전체 조회
      if (email && String(row[2] || '').trim().toLowerCase() !== email.toLowerCase()) continue;
      if (yearMonth && !rowDate.startsWith(yearMonth)) continue;
      // v10: J(9)=파일ID, K(10)=파일명, L(11)=파일URL
      results.push({
        date:        rowDate,
        amount:      parseInt(String(row[3] || '0').replace(/[^0-9]/g,''), 10) || 0,  // ← v11.2: 숫자 타입으로 반환
        memo:        String(row[4] || ''),       // E열: 일반 메모
        category:    String(row[5] || '법인카드'), // F열: 결제수단
        subCat1:     String(row[6] || ''),        // G열: 하위분류
        subCat2:     String(row[7] || ''),        // H열: 세부분류
        detailMemo:  String(row[8] || ''),        // I열: 세부메모
        fileId:      String(row[9]  || ''),       // J열
        fileName:    String(row[10] || ''),       // K열
        fileUrl:     String(row[11] || ''),       // L열
        rowIndex:    i + 1
      });
    }
    return _ok_(results);
  } catch (e) { return _err_('영수증 조회 실패: ' + e.message); }
}

function handleDeleteReceipt(payload) {
  try {
    var rowIndex = parseInt(payload.rowIndex, 10);
    var email    = String(payload.email || '').trim();
    var sh  = _ensureReceiptSheet_();
    var row = sh.getRange(rowIndex, 1, 1, 13).getValues()[0];
    if (String(row[2]) !== email) return _err_('권한 없음');
    var fileId = String(row[9] || '');  // J열(10번째) = 파일ID
    if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {} }
    sh.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    return _ok_(null);
  } catch (e) { return _err_('삭제 실패: ' + e.message); }
}

// ──────────────────────────────────────────────────────────────
// [11] 영수증 PDF 생성 — DriveApp blob 원본 우선 (해상도 수정)
// 변경: ①DriveApp blob PRIMARY(원본) ②thumbnail sz=w3000 폴백
// ──────────────────────────────────────────────────────────────
function handleGenerateReceiptPDF(payload) {
  try {
    var email     = String(payload.email     || '').trim();
    var yearMonth = String(payload.yearMonth || '').trim();
    if (!yearMonth) return _err_('yearMonth 필수');

    // 1. 해당 월 영수증 조회
    var res      = handleGetReceipts({ email: email, yearMonth: yearMonth });
    var obj      = JSON.parse(res.getContent());
    if (!obj.success) return _err_('조회 실패');
    var receipts = obj.data;
    if (!receipts || receipts.length === 0) return _err_('해당 월 영수증 없음');

    var userName = _nameByEmail_(email);
    var ymLabel  = yearMonth.replace('-', '년 ') + '월';
    var total    = receipts.reduce(function(s, r) { return s + (parseInt(r.amount, 10) || 0); }, 0);
    var genDate  = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

    // 2. DocumentApp으로 새 문서 생성
    var doc  = DocumentApp.create('_tmp_receipt_' + userName + '_' + yearMonth);
    var body = doc.getBody();

    // A4 페이지 설정 (단위: pt, 1pt = 1/72 inch)
    body.setPageWidth(595.28).setPageHeight(841.89);
    body.setMarginTop(50).setMarginBottom(50).setMarginLeft(50).setMarginRight(50);

    // ── 제목 ──
    var titlePara = body.appendParagraph('영수증 모음  |  ' + ymLabel);
    titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    titlePara.editAsText()
      .setFontSize(20)
      .setBold(true)
      .setForegroundColor('#1e3a5f');

    var subPara = body.appendParagraph(userName + '   생성일: ' + genDate);
    subPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    subPara.editAsText().setFontSize(11).setForegroundColor('#555555');

    var sumPara = body.appendParagraph('총 ' + receipts.length + '건   합계 ' + total.toLocaleString() + '원');
    sumPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    sumPara.editAsText().setFontSize(13).setBold(true).setForegroundColor('#2563eb');

    body.appendHorizontalRule();
    body.appendParagraph('');

    // ── 영수증 항목 ──
    for (var i = 0; i < receipts.length; i++) {
      var r    = receipts[i];
      var amt  = r.amount ? parseInt(r.amount, 10).toLocaleString() + '원' : '-';
      var cat  = r.category || '법인카드';
      if (cat === '법인카드') cat = '법인카드(일반)';
      var sub1 = r.subCat1 || '';
      var sub2 = r.subCat2 || '';
      var memo = r.detailMemo || r.memo || '';

      // 항목 헤더
      var headerText = (i + 1) + '.  ' + r.date + '   [' + cat + ']'
        + (sub1 ? '  ' + sub1 + (sub2 ? ' > ' + sub2 : '') : '')
        + '   ' + amt;
      var headerPara = body.appendParagraph(headerText);
      headerPara.editAsText().setFontSize(12).setBold(true).setForegroundColor('#1e293b');

      // 메모
      if (memo) {
        var memoPara = body.appendParagraph('    ' + memo);
        memoPara.editAsText().setFontSize(10).setForegroundColor('#64748b');
      }

      // 영수증 사진 삽입
      if (r.fileId) {
        var inserted = false;
        var MAX_WIDTH = 495;
        var token3 = ScriptApp.getOAuthToken();

        // ① DriveApp blob — PRIMARY (원본 해상도 유지)
        try {
          var imgBlob = DriveApp.getFileById(r.fileId).getBlob();
          var mt = imgBlob.getContentType() || 'image/jpeg';
          if (!mt.startsWith('image/')) mt = 'image/jpeg';
          imgBlob.setContentType(mt);
          var imgEl = body.appendImage(imgBlob);
          var w = imgEl.getWidth(); var h = imgEl.getHeight();
          if (w > MAX_WIDTH) { imgEl.setWidth(MAX_WIDTH); imgEl.setHeight(Math.round(h * (MAX_WIDTH / w))); }
          Logger.log('[PDF] DriveApp blob OK: ' + r.fileId);
          inserted = true;
        } catch (eD) {
          Logger.log('[PDF] DriveApp blob 실패, thumbnail 시도: ' + eD.message);
        }

        // ② thumbnail URL — FALLBACK (sz=w3000 고해상도)
        if (!inserted) {
          try {
            var thumbUrl = 'https://drive.google.com/thumbnail?id=' + r.fileId + '&sz=w3000';
            var thumbResp = UrlFetchApp.fetch(thumbUrl, {
              headers: { Authorization: 'Bearer ' + token3 },
              muteHttpExceptions: true
            });
            if (thumbResp.getResponseCode() === 200) {
              var thumbBlob = thumbResp.getBlob().setContentType('image/jpeg');
              var imgEl2 = body.appendImage(thumbBlob);
              var w2 = imgEl2.getWidth(); var h2 = imgEl2.getHeight();
              if (w2 > MAX_WIDTH) { imgEl2.setWidth(MAX_WIDTH); imgEl2.setHeight(Math.round(h2 * (MAX_WIDTH / w2))); }
              Logger.log('[PDF] thumbnail OK: ' + r.fileId);
              inserted = true;
            }
          } catch (eT) {
            Logger.log('[PDF] thumbnail 실패: ' + eT.message);
          }
        }

        if (!inserted) {
          body.appendParagraph('    [사진 첨부 실패 — fileId: ' + r.fileId + ']')
            .editAsText().setForegroundColor('#ef4444');
        }
      }
        if (false) { // 구 코드 제거됨 — 위 DriveApp/thumbnail 로직으로 대체
          if (!inserted) {
            body.appendParagraph('    [사진 첨부 실패]')
              .editAsText().setFontSize(10).setForegroundColor('#aaaaaa');
        }
      }

      body.appendParagraph(''); // 항목 간 여백
    }

    // ── 푸터 ──
    body.appendHorizontalRule();
    var footPara = body.appendParagraph('현장관리시스템   |   ' + email + '   |   ' + genDate + ' 출력');
    footPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    footPara.editAsText().setFontSize(9).setForegroundColor('#aaaaaa');

    // 3. 저장 후 PDF export
    doc.saveAndClose();
    Utilities.sleep(2000);

    var docId = doc.getId();
    var token = ScriptApp.getOAuthToken();
    var pdfResp = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + docId + '/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
    );

    // 임시 Docs 파일 삭제
    try { DriveApp.getFileById(docId).setTrashed(true); } catch(eDel) {
      Logger.log('[PDF] 임시 Docs 삭제 실패: ' + eDel.message);
    }

    if (pdfResp.getResponseCode() !== 200) {
      throw new Error('PDF export 실패 (HTTP ' + pdfResp.getResponseCode() + ')');
    }

    var pdfBlob = pdfResp.getBlob();
    var pdfName = userName + '_영수증_' + yearMonth + '.pdf';
    pdfBlob.setName(pdfName).setContentType('application/pdf');

    var pdfFile = _getReceiptFolder_(userName, yearMonth).createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return _ok_({ pdfUrl: 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view', fileName: pdfName });
  } catch (e) {
    return _err_('PDF 생성 실패: ' + e.message);
  }
}


function handleGetReleaseNotes() {
  try {
    var ss         = SpreadsheetApp.openById(현장관리시스템_SS_ID);
    var cacheSheet = _getReleaseCacheSheet_(ss);

    // 캐시 만료 기준: 24시간
    var CACHE_EXPIRE_HOURS = 24;

    if (cacheSheet && cacheSheet.getLastRow() >= 2) {
      // F열(6번째) 갱신시각으로 만료 여부 확인
      var updatedAtRaw = cacheSheet.getRange(2, 6).getValue();
      var cacheTime    = updatedAtRaw ? new Date(updatedAtRaw) : null;
      var now          = new Date();
      var diffHours    = cacheTime ? (now - cacheTime) / (1000 * 60 * 60) : 999;

      if (diffHours < CACHE_EXPIRE_HOURS) {
        // ── 캐시 유효: 그대로 반환 ──
        var rows   = cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, 6).getValues();
        var result = [];
        for (var i = 0; i < rows.length; i++) {
          var prod = String(rows[i][0] || '').trim();
          if (!prod) continue;
          result.push({
            product:  prod,
            version:  String(rows[i][1] || '').trim(),
            date:     String(rows[i][2] || '').trim(),
            pageUrl:  String(rows[i][3] || '').trim(),
            category: String(rows[i][4] || '').trim(),
          });
        }
        return _ok_(result);
      }

      // ── 캐시 만료: Confluence 재호출 후 갱신 ──
      Logger.log('릴리즈 캐시 만료 (' + Math.floor(diffHours) + '시간 경과) → Confluence 재호출');
    }

    // 캐시 없거나 만료 → Confluence 호출 + 캐시 저장
    return handleUpdateReleaseCache();
  } catch (e) {
    return _err_('릴리즈 노트 조회 실패: ' + e.message);
  }
}


/**
 * Confluence → 캐시 시트 갱신
 * - 야간 트리거(새벽 3시)에 의해 자동 실행
 * - 또는 GAS 에디터에서 수동 실행 가능
 * - 또는 앱에서 ?action=updateReleaseCache 로 수동 갱신
 */
function handleUpdateReleaseCache() {
  try {
    var auth    = Utilities.base64Encode(CONFLUENCE_EMAIL + ':' + CONFLUENCE_TOKEN);
    var headers = { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' };

    // 전체 페이지 수집
    var allPages = [];
    var start = 0;
    var limit = 50;
    while (true) {
      var url  = CONFLUENCE_BASE_URL + '/wiki/rest/api/content'
        + '?spaceKey=' + CONFLUENCE_SPACE
        + '&type=page&limit=' + limit + '&start=' + start
        + '&expand=ancestors,_links';
      var resp = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      if (resp.getResponseCode() !== 200) break;
      var data  = JSON.parse(resp.getContentText());
      var pages = data.results || [];
      for (var i = 0; i < pages.length; i++) allPages.push(pages[i]);
      if (pages.length < limit) break;
      start += limit;
    }

    // 제목 파싱: {Product}_{YYYYMMDD}_RELEASE.{version}
    var re         = /^(.+?)_(\d{8})_RELEASE\.(.+)$/;
    var productMap = {};

    for (var j = 0; j < allPages.length; j++) {
      var page  = allPages[j];
      var title = page.title;
      if (title.indexOf('RELEASE.') < 0) continue;
      if (title.charAt(0) === '[') continue;

      var m = title.match(re);
      if (!m) continue;

      var product = m[1].trim().replace(/^회사\s+/i, '');  // "회사 IPD" → "IPD"
      var dateRaw = m[2];
      var version = m[3];
      var pageUrl = CONFLUENCE_BASE_URL + '/wiki' + page._links.webui;
      var fmtDate = dateRaw.slice(0,4) + '-' + dateRaw.slice(4,6) + '-' + dateRaw.slice(6,8);

      // [OLD] 하위 페이지 제외 — 조상 중 [OLD] 포함된 것이 있으면 스킵
      var ancestors = page.ancestors || [];
      var isOld = false;
      for (var a = 0; a < ancestors.length; a++) {
        if (String(ancestors[a].title || '').indexOf('[OLD]') >= 0) {
          isOld = true;
          break;
        }
      }
      if (isOld) continue;

      // 카테고리 판별
      var category  = 'Other';
      for (var a = 0; a < ancestors.length; a++) {
        var aTitle = String(ancestors[a].title || '');
        if (aTitle.indexOf('(Web)') >= 0)             { category = 'Web';       break; }
        if (aTitle.indexOf('(Engine)') >= 0)          { category = 'Engine';    break; }
        if (aTitle.indexOf('On-premise') >= 0)        { category = 'OnPremise'; break; }
        if (aTitle.indexOf('인프라') >= 0)             { category = 'Infra';     break; }
      }

      if (!productMap[product] || dateRaw > productMap[product].dateRaw) {
        productMap[product] = { product: product, version: version, date: fmtDate, dateRaw: dateRaw, pageUrl: pageUrl, category: category };
      }
    }

    var releases = [];
    for (var key in productMap) releases.push(productMap[key]);
    releases.sort(function(a, b) { return b.dateRaw.localeCompare(a.dateRaw); });

    // 캐시 시트 저장
    var ss         = SpreadsheetApp.openById(현장관리시스템_SS_ID);
    var cacheSheet = _getReleaseCacheSheet_(ss);
    if (!cacheSheet) {
      cacheSheet = ss.insertSheet(HL_SH.RELEASE_CACHE);
      cacheSheet.appendRow(['제품명','버전','날짜','페이지URL','카테고리','갱신시각']);
      cacheSheet.setFrozenRows(1);
    }

    // 기존 데이터 삭제 후 재기록
    if (cacheSheet.getLastRow() > 1) {
      cacheSheet.getRange(2, 1, cacheSheet.getLastRow() - 1, 6).clearContent();
    }

    var updatedAt = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var rows = releases.map(function(r) {
      return [r.product, r.version, r.date, r.pageUrl, r.category, updatedAt];
    });
    if (rows.length > 0) {
      cacheSheet.getRange(2, 1, rows.length, 6).setValues(rows);
    }
    SpreadsheetApp.flush();

    // 반환값 (앱에서 바로 사용 가능)
    var result = releases.map(function(r) {
      return { product: r.product, version: r.version, date: r.date, pageUrl: r.pageUrl, category: r.category };
    });
    return _ok_(result);

  } catch (e) {
    return _err_('릴리즈 캐시 갱신 실패: ' + e.message);
  }
}


/**
 * 야간 자동 트리거 설정 — GAS 에디터에서 1회 수동 실행하면 설정 완료
 * 매일 새벽 3시에 handleUpdateReleaseCache() 자동 실행
 */
function setupReleaseCacheTrigger() {
  // 기존 트리거 삭제 (중복 방지)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'handleUpdateReleaseCache') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 매일 새벽 3시 트리거 등록
  ScriptApp.newTrigger('handleUpdateReleaseCache')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('✅ 야간 릴리즈 캐시 트리거 설정 완료 (매일 03:00)');
}


// ============================================================
// [v6] 직원목록 관리
// ============================================================

// ── 직원목록 시트 헬퍼 ─────────────────────────────────────
function _getStaffSheet_(ss) {
  var sh = ss.getSheetByName(HL_SH.STAFF);
  if (sh) return sh;
  return _getSheetByKeyword_(ss, '직원목록');
}

// ── 수정이력 시트 헬퍼 ─────────────────────────────────────
function _getEditLogSheet_(ss) {
  var sh = ss.getSheetByName(HL_SH.EDIT_LOG);
  if (sh) return sh;
  return _getSheetByKeyword_(ss, '수정이력');
}

// ── 직원목록 시트 자동 생성 ────────────────────────────────
function _ensureStaffSheet_(ss) {
  var sh = _getStaffSheet_(ss);
  if (!sh) {
    sh = ss.insertSheet(HL_SH.STAFF);
    sh.appendRow(['이름', '이메일', '권한', '가입일', '부서']);
    sh.setFrozenRows(1);
    // 헤더 스타일
    sh.getRange(1, 1, 1, 5).setBackground('#4a5568').setFontColor('#ffffff').setFontWeight('bold');
    // 초기 관리자 등록
    sh.appendRow(['김성환', INITIAL_ADMIN_EMAIL, '관리자', Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'), 'TE']);
  }
  return sh;
}

// ── 수정이력 시트 자동 생성 ────────────────────────────────
function _ensureEditLogSheet_(ss) {
  var sh = _getEditLogSheet_(ss);
  if (!sh) {
    sh = ss.insertSheet(HL_SH.EDIT_LOG);
    sh.appendRow(['시트명', '행번호', '이메일', '수정일시', '수정횟수']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 5).setBackground('#4a5568').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sh;
}

/**
 * 로그인 시 호출 — 직원 자동 등록 + 권한/이름 반환
 * params: { email, name }
 */
function handleGetOrRegisterStaff(params) {
  var email = String((params && params.email) || '').trim().toLowerCase();
  var name  = String((params && params.name)  || '').trim();
  if (!email || !email.endsWith('@i회사.com')) return _err_('i회사.com 계정만 허용됩니다.');

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _ensureStaffSheet_(ss);

  var lastRow = sh.getLastRow();
  var data = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, 5).getValues() : [];

  // 이미 등록된 직원인지 확인
  for (var i = 0; i < data.length; i++) {
    var rowEmail = String(data[i][1] || '').trim().toLowerCase();
    if (rowEmail === email) {
      return _ok_({
        name:      String(data[i][0] || name),
        email:     email,
        role:      String(data[i][2] || '일반'),
        dept:      String(data[i][4] || ''),
        isNew:     false,
      });
    }
  }

  // 신규 — 자동 등록 (권한: 일반, 부서: 미지정)
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  sh.appendRow([name, email, '일반', today, '']);
  SpreadsheetApp.flush();

  return _ok_({
    name:  name,
    email: email,
    role:  '일반',
    dept:  '',
    isNew: true,
  });
}

/**
 * 직원 목록 전체 반환 (재인계 등에서 사용)
 * 직원목록 시트 우선, 없으면 회사_STAFF 폴백
 */
function handleGetStaffList() {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getStaffSheet_(ss);

  if (!sh || sh.getLastRow() < 2) {
    return _ok_(회사_STAFF);
  }

  var colCount = Math.min(sh.getLastColumn(), 5);
  var data   = sh.getRange(2, 1, sh.getLastRow() - 1, colCount).getValues();
  var result = [];
  for (var i = 0; i < data.length; i++) {
    var n = String(data[i][0] || '').trim();
    var e = String(data[i][1] || '').trim();
    if (n && e) result.push({ name: n, email: e, role: String(data[i][2] || '일반').trim(), dept: String(data[i][4] || '').trim() });
  }
  return _ok_(result);
}

// ── 권한 조회 헬퍼 ─────────────────────────────────────────
function _getStaffRole_(ss, email) {
  if (!email) return '일반';
  var emailL = email.toLowerCase();
  if (emailL === INITIAL_ADMIN_EMAIL.toLowerCase()) {
    var sh = _getStaffSheet_(ss);
    if (!sh || sh.getLastRow() < 2) return '관리자'; // 시트 없으면 초기 관리자
  }
  var sh = _getStaffSheet_(ss);
  if (!sh || sh.getLastRow() < 2) return '일반';
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toLowerCase() === emailL) {
      return String(data[i][2] || '일반').trim();
    }
  }
  return '일반';
}

// ── 이름 조회 헬퍼 ─────────────────────────────────────────
function _getStaffName_(ss, email) {
  if (!email) return '';
  var emailL = email.toLowerCase();
  var sh = _getStaffSheet_(ss);
  if (sh && sh.getLastRow() >= 2) {
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][1] || '').trim().toLowerCase() === emailL) {
        return String(data[i][0] || '').trim();
      }
    }
  }
  // 회사_STAFF 폴백
  for (var j = 0; j < 회사_STAFF.length; j++) {
    if (회사_STAFF[j].email.toLowerCase() === emailL) return 회사_STAFF[j].name;
  }
  return email.split('@')[0];
}


// ============================================================
// [v6] 내가 한 일 조회
// ============================================================

/**
 * 로그인한 사용자가 등록한 CS이력 + 데모 이력 반환
 * params: { email }
 */
function handleGetMyHistory(params) {
  var email = String((params && params.email) || '').trim().toLowerCase();
  if (!email) return _ok_({ cs: [], demo: [] });

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var staffName = _getStaffName_(ss, email);

  // ── CS 이력 (20열 기준) ──────────────────────────────────
  var csSheet = ss.getSheetByName(HL_SH.CS);
  var csItems = [];
  if (csSheet && csSheet.getLastRow() >= 3) {
    var csData = csSheet.getRange(3, 1, csSheet.getLastRow() - 2, 20).getValues();

    // 날짜 기준 필터: 1개월
    var cutoff1m = new Date();
    cutoff1m.setMonth(cutoff1m.getMonth() - 1);
    // 전체용 1년
    var cutoff1y = new Date();
    cutoff1y.setFullYear(cutoff1y.getFullYear() - 1);

    for (var i = 0; i < csData.length; i++) {
      var row = csData[i];
      var handler = String(row[8] || '').trim();  // I(8): 휴런담당자
      if (!handler) continue;
      if (handler !== staffName && handler.toLowerCase() !== email) continue;

      var reqDateVal = row[2];  // C(2): 요청일자
      var reqDateObj = (reqDateVal instanceof Date) ? reqDateVal : new Date(String(reqDateVal));
      // 1년 내 데이터만 포함 (전체 기준)
      if (!isNaN(reqDateObj) && reqDateObj < cutoff1y) continue;

      csItems.push({
        type:         'cs',
        rowIndex:     i + 3,
        병원명:       String(row[1]  || '').trim(),   // B(1)
        접수일:       _fmtDate_(row[2]),               // C(2)
        처리완료일:   _fmtDate_(row[3]),               // D(3)
        요청유형:     String(row[5]  || '').trim(),    // F(5)
        접수내용:     String(row[6]  || '').trim(),    // G(6) 요청내용(상세요약)
        처리사항:     String(row[13] || '').trim(),    // N(13) 처리내용(상세요약)
        CS상태:       String(row[11] || '접수').trim(), // L(11) 상태
        csStatus:     String(row[11] || '접수').trim(), // L(11) 중복 제공 (호환)
        제품명:       String(row[9]  || '').trim(),   // J(9)
        코드분류:     String(row[17] || '').trim(),   // R(17)
        대응방식:     String(row[12] || '').trim(),   // M(12)
        담당자:       handler,
        사진URL:      String(row[19] || '').trim(),   // T(19)
      });
    }
    csItems.sort(function(a, b) { return b.접수일.localeCompare(a.접수일); });
  }

  // ── 데모 등록 이력 ──────────────────────────────────────
  var domSh = _getDomesticSheet_(ss);
  var demoItems = [];
  if (domSh && domSh.getLastRow() >= 3) {
    var domData = domSh.getRange(3, 1, domSh.getLastRow() - 2, 21).getValues();
    for (var j = 0; j < domData.length; j++) {
      var dr = domData[j];
      var instType = String(dr[3] || '').trim();
      var demoMgr  = String(dr[11] || '').trim();
      if (instType.indexOf('데모') < 0) continue;
      if (demoMgr !== staffName && demoMgr.toLowerCase() !== email) continue;
      demoItems.push({
        type:     'demo',
        rowIndex: j + 3,
        병원명:   String(dr[2]  || '').trim(),
        제품명:   String(dr[6]  || '').trim(),
        버전:     String(dr[7]  || '').trim(),
        설치일:   _fmtDate_(dr[9]),
        만료일:   _fmtDate_(dr[10]),
        상태:     _calcStatus_(_fmtDate_(dr[10]), String(dr[8] || '')),
        설치장소: String(dr[17] || '').trim(),
        담당자:   demoMgr,
      });
    }
    demoItems.sort(function(a, b) { return b.설치일.localeCompare(a.설치일); });
    demoItems = demoItems.slice(0, 20);
  }

  return _ok_({ cs: csItems, demo: demoItems });
}


// ============================================================
// [v6] 수정 횟수 조회
// ============================================================

/**
 * 특정 행의 수정 횟수 조회
 * params: { sheetType: 'cs'|'demo', rowIndex }
 */
function handleGetEditCount(params) {
  var sheetType = String((params && params.sheetType) || 'cs');
  var rowIndex  = parseInt((params && params.rowIndex) || '0', 10);
  if (!rowIndex) return _ok_({ count: 0 });

  var ss  = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh  = _ensureEditLogSheet_(ss);
  var key = sheetType + '_' + rowIndex;

  if (sh.getLastRow() < 2) return _ok_({ count: 0 });
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === sheetType && parseInt(data[i][1], 10) === rowIndex) {
      return _ok_({ count: parseInt(data[i][4], 10) || 0 });
    }
  }
  return _ok_({ count: 0 });
}

// ── 수정 횟수 기록 내부 헬퍼 ───────────────────────────────
function _recordEdit_(ss, sheetType, rowIndex, email) {
  var sh  = _ensureEditLogSheet_(ss);
  var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');

  if (sh.getLastRow() >= 2) {
    var data = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === sheetType && parseInt(data[i][1], 10) === rowIndex) {
        var newCount = (parseInt(data[i][4], 10) || 0) + 1;
        sh.getRange(i + 2, 3).setValue(email);
        sh.getRange(i + 2, 4).setValue(now);
        sh.getRange(i + 2, 5).setValue(newCount);
        return newCount;
      }
    }
  }
  sh.appendRow([sheetType, rowIndex, email, now, 1]);
  return 1;
}


// ============================================================
// [v6] CS 이력 수정
// ============================================================

/**
 * CS 이력 수정
 * payload: { rowIndex, email, 병원명, 제품명, 요청유형, 접수내용, 처리사항, 접수일 }
 * 일반: 1회 제한, 관리자: 무제한
 */
function handleUpdateCSRecord(payload) {
  var rowIndex = parseInt(payload.rowIndex, 10);
  var email    = String(payload.email || '').trim().toLowerCase();
  if (!rowIndex || !email) return _err_('rowIndex, email 필수');

  var ss   = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var role = _getStaffRole_(ss, email);

  var sh = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('CS이력 시트 없음');
  if (rowIndex > sh.getLastRow()) return _err_('행 번호 오류');

  // 기존 행 조회 — 담당자 확인
  var rowData   = sh.getRange(rowIndex, 1, 1, 20).getValues()[0];
  var handler   = String(rowData[8] || '').trim();  // I(8): 휴런담당자
  var staffName = _getStaffName_(ss, email);

  if (role !== '관리자' && handler !== staffName && handler.toLowerCase() !== email) {
    return _err_('본인이 등록한 CS 이력만 수정할 수 있습니다.');
  }

  // 20열 기준 수정
  if (payload.병원명 !== undefined && payload.병원명 !== '')    sh.getRange(rowIndex, 2).setValue(String(payload.병원명));   // B(2)
  if (payload.요청유형 !== undefined && payload.요청유형 !== '') sh.getRange(rowIndex, 6).setValue(String(payload.요청유형)); // F(6)
  if (payload.접수내용 !== undefined && payload.접수내용 !== '') sh.getRange(rowIndex, 7).setValue(String(payload.접수내용)); // G(7)
  if (payload.요청내용상세 !== undefined)                        sh.getRange(rowIndex, 8).setValue(String(payload.요청내용상세 || '')); // H(8)
  if (payload.제품명 !== undefined && payload.제품명 !== '')    sh.getRange(rowIndex, 10).setValue(String(payload.제품명));  // J(10)
  if (payload.제품버전 !== undefined)                           sh.getRange(rowIndex, 11).setValue(String(payload.제품버전 || '').replace(/\s+/g, '')); // K(11)
  if (payload.대응방식 !== undefined)                           sh.getRange(rowIndex, 13).setValue(String(payload.대응방식 || '')); // M(13)
  if (payload.처리사항 !== undefined && payload.처리사항 !== '') sh.getRange(rowIndex, 14).setValue(String(payload.처리사항)); // N(14)
  if (payload.처리내용상세 !== undefined)                       sh.getRange(rowIndex, 15).setValue(String(payload.처리내용상세 || '')); // O(15)
  if (payload.비고 !== undefined)                               sh.getRange(rowIndex, 17).setValue(String(payload.비고 || '')); // Q(17)
  if (payload.코드분류 !== undefined)                           sh.getRange(rowIndex, 18).setValue(String(payload.코드분류 || '')); // R(18)
  if (payload.고객피드백 !== undefined)                         sh.getRange(rowIndex, 19).setValue(String(payload.고객피드백 || '미반영')); // S(19)
  if (payload.접수일) {
    sh.getRange(rowIndex, 3).setValue(new Date(payload.접수일)).setNumberFormat('yyyy-MM-dd'); // C(3)
  }
  if (payload.담당자정보 !== undefined) sh.getRange(rowIndex, 5).setValue(String(payload.담당자정보 || '')); // E(5)

  // 사진 URL 업데이트 — T(20) → 1-indexed=20
  if (Array.isArray(payload.photoUrls)) {
    sh.getRange(rowIndex, 20).setValue(payload.photoUrls.join(', '));
  }

  // CS 상태 + 처리완료일 — L(12) → 1-indexed=12
  if (payload.csStatus !== undefined && payload.csStatus !== '') {
    sh.getRange(rowIndex, 12).setValue(String(payload.csStatus));
    if (String(payload.csStatus) === '완료') {
      sh.getRange(rowIndex, 4).setValue(new Date()).setNumberFormat('yyyy-MM-dd');
    } else {
      sh.getRange(rowIndex, 4).clearContent();
    }
  }
  SpreadsheetApp.flush();
  return _ok_({ updated: true });
}


// ──────────────────────────────────────────────────────────────
// [v7] CS 상태 변경 (누구나 가능, 완료 시 처리완료일 자동)
// ──────────────────────────────────────────────────────────────
function handleUpdateCSStatus(payload) {
  var rowIndex = parseInt(payload.rowIndex, 10);
  var newStatus = String(payload.csStatus || '').trim();
  if (!rowIndex || !newStatus) return _err_('rowIndex, csStatus 필수');

  var VALID = ['접수', '진행중', '완료', '보류'];
  if (VALID.indexOf(newStatus) < 0) return _err_('유효하지 않은 상태: ' + newStatus);

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('CS이력 시트 없음');
  if (rowIndex > sh.getLastRow()) return _err_('행 번호 오류');

  // L(12) → 1-indexed=12: 상태
  sh.getRange(rowIndex, 12).setValue(newStatus);

  if (newStatus === '완료') {
    sh.getRange(rowIndex, 4).setValue(new Date()).setNumberFormat('yyyy-MM-dd');
  } else {
    sh.getRange(rowIndex, 4).clearContent();
  }
  SpreadsheetApp.flush();
  return _ok_({ updated: true, csStatus: newStatus });
}


// ──────────────────────────────────────────────────────────────
// [v7] CS 이력 삭제 (본인 등록 또는 관리자만)
// ──────────────────────────────────────────────────────────────
function handleDeleteCSRecord(payload) {
  var rowIndex = parseInt(payload.rowIndex, 10);
  var email    = String(payload.email || '').trim().toLowerCase();
  if (!rowIndex || !email) return _err_('rowIndex, email 필수');

  var ss   = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var role = _getStaffRole_(ss, email);
  var sh   = ss.getSheetByName(HL_SH.CS);
  if (!sh) return _err_('CS이력 시트 없음');
  if (rowIndex > sh.getLastRow()) return _err_('행 번호 오류');

  // 본인 데이터 확인 (관리자는 스킵)
  if (role !== '관리자') {
    var staffName = _getStaffName_(ss, email);
    var handler   = String(sh.getRange(rowIndex, 9).getValue() || '').trim(); // I열: 처리자
    if (handler !== staffName && handler.toLowerCase() !== email) {
      return _err_('본인이 등록한 CS 이력만 삭제할 수 있습니다.');
    }
  }

  sh.deleteRow(rowIndex);
  SpreadsheetApp.flush();
  return _ok_({ deleted: true });
}

// ──────────────────────────────────────────────────────────────
// [v7] 전체 CS 이력 조회 (병원 상세와 별개로 담당자 전체 조회)
// ──────────────────────────────────────────────────────────────
function handleGetCSHistory(params) {
  var email     = String((params && params.email)     || '').trim().toLowerCase();
  var csStatus  = String((params && params.csStatus)  || '').trim();
  if (!email) return _ok_([]);

  var ss        = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var staffName = _getStaffName_(ss, email);
  var csSheet   = ss.getSheetByName(HL_SH.CS);
  if (!csSheet || csSheet.getLastRow() < 3) return _ok_([]);

  // 날짜 기준: csStatus=전체이면 1년, 나머지 1개월
  var cutoff = new Date();
  if (!csStatus || csStatus === '전체') {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else {
    cutoff.setMonth(cutoff.getMonth() - 1);
  }

  var data   = csSheet.getRange(3, 1, csSheet.getLastRow() - 2, 22).getValues(); // Q(16)비고까지 포함
  var result = [];

  for (var i = 0; i < data.length; i++) {
    var row     = data[i];
    var handler = String(row[8] || '').trim();    // I(8): 휴런담당자
    if (!handler) continue;
    if (handler !== staffName && handler.toLowerCase() !== email) continue;

    var reqDateVal = row[2];
    var reqDateObj = (reqDateVal instanceof Date) ? reqDateVal : new Date(String(reqDateVal));
    if (!isNaN(reqDateObj) && reqDateObj < cutoff) continue;

    var status = String(row[11] || '').trim() || '접수'; // L(11): 상태
    if (csStatus && csStatus !== '전체' && status !== csStatus) continue;

    result.push({
      rowIndex:   i + 3,
      병원명:     String(row[1]  || '').trim(),   // B(1)
      접수일:     _fmtDate_(row[2]),               // C(2)
      처리완료일: _fmtDate_(row[3]),               // D(3)
      요청유형:   String(row[5]  || '').trim(),    // F(5)
      접수내용:   String(row[6]  || '').trim(),    // G(6)
      처리사항:         String(row[13] || '').trim(),    // N(13) 처리내용(상세요약)
      처리내용서술형:   String(row[14] || '').trim(),    // O(14) 처리내용 서술형
      비고:             String(row[16] || '').trim(),    // Q(16) 비고
      CS상태:     status,
      csStatus:   status,
      제품명:     String(row[9]  || '').trim(),   // J(9)
      버전:       String(row[10] || '').trim(),   // K(10) 제품버전
      대응방식:   String(row[12] || '').trim(),   // M(12)
      코드분류:   String(row[17] || '').trim(),   // R(17)
      담당자:     handler,
      사진URL:    String(row[19] || '').trim(),   // T(19)
    });
  }
  result.sort(function(a, b) { return b.접수일.localeCompare(a.접수일); });
  return _ok_(result);
}


// ============================================================
// [v6] 데모 이력 수정
// ============================================================

/**
 * 데모 등록 수정 (제품현황_국내 시트)
 * payload: { rowIndex, email, 병원명, 제품명, 버전, 설치장소, 만료일 }
 * 일반: 1회 제한, 관리자: 무제한
 */
function handleUpdateDemoRecord(payload) {
  var rowIndex = parseInt(payload.rowIndex, 10);
  var email    = String(payload.email || '').trim().toLowerCase();
  if (!rowIndex || !email) return _err_('rowIndex, email 필수');

  var ss   = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var role = _getStaffRole_(ss, email);

  // 수정 권한 체크 (일반: 1회 제한)
  if (role !== '관리자') {
    var editRes   = handleGetEditCount({ sheetType: 'demo', rowIndex: rowIndex });
    var editObj   = JSON.parse(editRes.getContent());
    var editCount = editObj.success ? (editObj.data.count || 0) : 0;
    if (editCount >= 1) return _err_('수정 가능 횟수를 초과했습니다. (일반: 1회)');
  }

  var sh = _getDomesticSheet_(ss);
  if (!sh) return _err_('제품현황_국내 시트 없음');
  if (rowIndex > sh.getLastRow()) return _err_('행 번호 오류');

  // 담당자 확인
  var rowData   = sh.getRange(rowIndex, 1, 1, 12).getValues()[0];
  var handler   = String(rowData[11] || '').trim();
  var staffName = _getStaffName_(ss, email);

  if (role !== '관리자' && handler !== staffName && handler.toLowerCase() !== email) {
    return _err_('본인이 등록한 데모만 수정할 수 있습니다.');
  }

  // 수정 적용 (0-based → 시트는 1-based)
  if (payload.병원명)   sh.getRange(rowIndex, 3).setValue(String(payload.병원명));   // C열
  if (payload.제품명)   sh.getRange(rowIndex, 7).setValue(String(payload.제품명));   // G열
  if (payload.버전)     sh.getRange(rowIndex, 8).setValue(String(payload.버전));     // H열
  if (payload.설치장소) sh.getRange(rowIndex, 18).setValue(String(payload.설치장소)); // R열
  if (payload.만료일) {
    sh.getRange(rowIndex, 11).setValue(new Date(payload.만료일)).setNumberFormat('yyyy-MM-dd');
  }
  if (payload.IP)       sh.getRange(rowIndex, 13).setValue(String(payload.IP));      // M열
  if (payload.원격)     sh.getRange(rowIndex, 14).setValue(String(payload.원격));    // N열
  SpreadsheetApp.flush();

  var newCount = _recordEdit_(ss, 'demo', rowIndex, email);
  SpreadsheetApp.flush();

  return _ok_({ updated: true, editCount: newCount, remaining: role === '관리자' ? 999 : Math.max(0, 1 - newCount) });
}


// ──────────────────────────────────────────────────────────────
// [v8] 국내제품현황 목록 조회 (신규병원 탭용)
// params.filter: 'demo' | 'commercial' | 'all'
// params.period: '1month' | 'all'
// ──────────────────────────────────────────────────────────────
function handleGetDomesticList(params) {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = _getDomesticSheet_(ss);
  if (!sh) return _err_('시트 없음: 제품현황_국내');

  var lastRow = sh.getLastRow();
  if (lastRow < 3) return _ok_([]);

  var filter = String((params && params.filter) || 'all').trim();   // demo | commercial | all
  var period = String((params && params.period) || '1month').trim(); // 1month | all

  var data   = sh.getRange(3, 1, lastRow - 2, 28).getValues();
  var result = [];
  var today  = new Date();
  var oneMonthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

  for (var i = 0; i < data.length; i++) {
    var row     = data[i];
    var site    = String(row[2] || '').trim();
    if (!site) continue;

    var licType  = String(row[8]  || '').trim(); // I열: 라이선스유형
    var instDate = row[9];                        // J열: 최초설치날짜

    var isDemo       = licType.indexOf('데모') >= 0 || licType.toLowerCase().indexOf('demo') >= 0;
    var isCommercial = licType.indexOf('상용') >= 0 || licType.toLowerCase().indexOf('commercial') >= 0;

    // filter 적용
    if (filter === 'demo'       && !isDemo)       continue;
    if (filter === 'commercial' && !isCommercial) continue;

    // period 적용
    if (period === '1month' && instDate) {
      var instDt = instDate instanceof Date ? instDate : new Date(instDate);
      if (!isNaN(instDt.getTime()) && instDt < oneMonthAgo) continue;
    }

    result.push({
      rowIndex:       i + 3,              // 시트 행번호 (수정/삭제용)
      행정구분:       String(row[1]  || '').trim(),
      병원명:         site,
      설치유형:       String(row[3]  || '').trim(),
      계약유형:       String(row[4]  || '').trim(),
      제품유형:       String(row[5]  || '').trim(),
      제품명:         String(row[6]  || '').trim(),
      버전:           String(row[7]  || '').trim(),
      라이선스유형:   licType,
      최초설치날짜:   _fmtDate_(row[9]),
      라이선스만료일: _fmtDate_(row[10]),
      주담당자:       String(row[11] || '').trim(),
      IP주소:         String(row[12] || '').trim(),
      연동방식:       String(row[13] || '').trim(),
      장비제조사:     String(row[14] || '').trim(),
      상세연동내역:   String(row[15] || '').trim(),
      사용자담당자정보: String(row[16] || '').trim(),
      설치장소:       String(row[17] || '').trim(),
      PACS업체정보:   String(row[18] || '').trim(),
      원격가능:       String(row[19] || '').trim(),
      관리코드:       String(row[20] || '').trim(),
      설치확인서:     String(row[21] || '').trim(),
      비고:           String(row[22] || '').trim(),
      원격번호:       String(row[25] || '').trim(),
      사진첨부URL:    String(row[26] || '').trim(),
      설치사진URL:    String(row[27] || '').trim(),
    });
  }

  return _ok_(result);
}


// ──────────────────────────────────────────────────────────────
// [v8] 국내제품현황 행 수정 (26열 완전 매핑)
// ──────────────────────────────────────────────────────────────
function handleUpdateDomesticRow(payload) {
  var rowIndex = parseInt(payload.rowIndex, 10);
  var email    = String(payload.email || '').trim().toLowerCase();
  if (!rowIndex || !email) return _err_('rowIndex, email 필수');

  var ss   = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh   = _getDomesticSheet_(ss);
  if (!sh) return _err_('제품현황_국내 시트 없음');
  if (rowIndex > sh.getLastRow()) return _err_('행 번호 오류');

  var set = function(col, val) {
    if (val !== undefined && val !== null) sh.getRange(rowIndex, col).setValue(val);
  };

  set(2,  String(payload.행정구분       || ''));
  set(3,  String(payload.병원명         || ''));
  set(4,  String(payload.설치유형       || ''));
  set(5,  String(payload.계약유형       || ''));
  set(6,  String(payload.제품유형       || ''));
  set(7,  String(payload.제품명         || ''));
  set(8,  String(payload.버전           || ''));
  set(9,  String(payload.라이선스유형   || ''));
  if (payload.최초설치날짜)   { sh.getRange(rowIndex, 10).setValue(new Date(payload.최초설치날짜)).setNumberFormat('yyyy-MM-dd'); }
  if (payload.라이선스만료일) { sh.getRange(rowIndex, 11).setValue(new Date(payload.라이선스만료일)).setNumberFormat('yyyy-MM-dd'); }
  set(12, String(payload.주담당자       || ''));
  set(13, String(payload.IP주소         || ''));
  set(14, String(payload.연동방식       || ''));
  set(15, String(payload.장비제조사     || ''));
  set(16, String(payload.상세연동내역   || ''));
  set(17, String(payload.사용자담당자정보 || ''));
  set(18, String(payload.설치장소       || ''));
  set(19, String(payload.PACS업체정보   || ''));
  set(20, String(payload.원격가능       || ''));
  set(21, String(payload.관리코드       || ''));
  set(23, String(payload.비고           || ''));
  set(26, String(payload.원격번호       || ''));

  SpreadsheetApp.flush();
  return _ok_({ updated: true, rowIndex: rowIndex });
}


// ──────────────────────────────────────────────────────────────
// [v8] 국내제품현황 행 삭제
// ──────────────────────────────────────────────────────────────
function handleDeleteDomesticRow(payload) {
  var rowIndex = parseInt(payload.rowIndex, 10);
  var email    = String(payload.email || '').trim().toLowerCase();
  if (!rowIndex || !email) return _err_('rowIndex, email 필수');

  var ss   = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var role = _getStaffRole_(ss, email);
  var sh   = _getDomesticSheet_(ss);
  if (!sh) return _err_('제품현황_국내 시트 없음');
  if (rowIndex > sh.getLastRow()) return _err_('행 번호 오류');

  // 관리자만 삭제 가능 (또는 본인 등록 데이터)
  if (role !== '관리자') {
    var staffName = _getStaffName_(ss, email);
    var handler   = String(sh.getRange(rowIndex, 12).getValue() || '').trim(); // L열: 주담당자
    if (handler !== staffName && handler.toLowerCase() !== email) {
      return _err_('본인이 등록한 데이터만 삭제할 수 있습니다.');
    }
  }

  sh.deleteRow(rowIndex);
  SpreadsheetApp.flush();
  return _ok_({ deleted: true });
}

// ──────────────────────────────────────────────────────────────
// [v9] 공지사항 & 엔지니어 공유 조회
// type: 'notice'(공지사항 3종) | 'engineer'(엔지니어공유 5종) | 'all'
// 시트 컬럼: No(A) | 항목(B) | 이슈날짜(C) | 공지날짜(D) | 최상단노출(E) | 병원명(F) | 작성자(G) | 구분(H) | 내용(I) | 상세내용(J)
// ──────────────────────────────────────────────────────────────
function handleGetNotices(params) {
  var type = String((params && params.type) || 'all').trim().toLowerCase();

  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(HL_SH.NOTICE);
  if (!sh) {
    // 이모지 없는 이름으로 재시도
    sh = _getSheetByKeyword_(ss, '공지사항 및 엔지니어');
  }
  if (!sh) return _ok_([]);

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return _ok_([]);

  var data = sh.getRange(2, 1, lastRow - 1, 10).getValues(); // 헤더(1행) 스킵
  var result = [];

  // 공지사항 항목 목록
  var NOTICE_ITEMS    = ['일반공지', '업무공지', '기타공지'];
  var ENGINEER_ITEMS  = ['SW이슈', 'HW이슈', 'OS이슈', '고객관리', '기타이슈'];

  for (var i = 0; i < data.length; i++) {
    var row     = data[i];
    var item    = String(row[1] || '').trim(); // B열: 항목
    if (!item) continue;

    var isNotice   = NOTICE_ITEMS.indexOf(item) >= 0;
    var isEngineer = ENGINEER_ITEMS.indexOf(item) >= 0;

    // type 필터
    if (type === 'notice'   && !isNotice)   continue;
    if (type === 'engineer' && !isEngineer) continue;
    if (!isNotice && !isEngineer)           continue; // 알 수 없는 항목 제외

    var pinned     = String(row[4] || '').trim().toLowerCase(); // E열: 최상단노출 (o/x)
    var hospitalNm = String(row[5] || '').trim();               // F열: 병원명
    // 공지사항은 병원명 노출 안 함
    if (isNotice) hospitalNm = '';

    var issueDateRaw  = row[2]; // C열: 이슈날짜
    var noticeDateRaw = row[3]; // D열: 공지날짜
    var displayDate   = isNotice
      ? _fmtDate_(noticeDateRaw || issueDateRaw)
      : _fmtDate_(issueDateRaw || noticeDateRaw);

    result.push({
      no:          String(row[0] || '').trim(),
      항목:        item,
      type:        isNotice ? 'notice' : 'engineer',
      날짜:        displayDate,
      최상단노출:  (pinned === 'o' || pinned === 'O'),
      병원명:      hospitalNm,
      작성자:      String(row[6] || '').trim(), // G열
      구분:        String(row[7] || '').trim(), // H열
      내용:        String(row[8] || '').trim(), // I열
      상세내용:    String(row[9] || '').trim(), // J열
    });
  }

  // 정렬: 최상단노출(o) 먼저, 그 다음 날짜 내림차순
  result.sort(function(a, b) {
    if (a.최상단노출 !== b.최상단노출) return a.최상단노출 ? -1 : 1;
    return (b.날짜 || '').localeCompare(a.날짜 || '');
  });

  return _ok_(result);
}

// ============================================================
// [v11] 구글 캘린더 자동 등록 (CS 등록 시 호출)
// 개인 캘린더 + 공용 캘린더 동시 등록
// ============================================================
var SHARED_CALENDAR_ID = 'c_04bcb34c41f35f046ce5045b2b2d5a4da02ea38c26b92f4fd765ae47c335d3d3@group.calendar.google.com';

function _registerToCalendar_(payload, rowIndex) {
  try {
    var title       = '[CS] ' + String(payload.hospitalName || '');
    var description = [
      '요청유형: ' + String(payload.requestType || ''),
      '요청내용: ' + String(payload.description || ''),
      '담당자: '  + String(payload.handlerName  || ''),
      '제품: '    + String(payload.productName  || '') + ' ' + String(payload.productVersion || ''),
      '대응방식: '+ String(payload.responseMethod || ''),
      '상태: '    + String(payload.csStatus || '접수'),
      '시트 행: ' + rowIndex,
    ].join('\n');

    // 날짜+시간 파싱
    var reqDateStr = String(payload.reqDate || '');
    var startDate, endDate;
    if (reqDateStr.indexOf('T') > 0) {
      // 시간 포함 (e.g. "2026-04-29T14:00")
      startDate = new Date(reqDateStr);
      endDate   = new Date(startDate.getTime() + 60 * 60 * 1000); // +1시간
    } else {
      // 날짜만 → 종일 이벤트
      var parts = reqDateStr.split('-');
      startDate = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
      endDate   = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]) + 1);
    }

    var hasTime = reqDateStr.indexOf('T') > 0;

    // ① 개인 캘린더 (실행 계정)
    var personalCal = CalendarApp.getDefaultCalendar();
    if (hasTime) {
      personalCal.createEvent(title, startDate, endDate, { description: description });
    } else {
      personalCal.createAllDayEvent(title, startDate, { description: description });
    }

    // ② 공용 캘린더
    try {
      var sharedCal = CalendarApp.getCalendarById(SHARED_CALENDAR_ID);
      if (sharedCal) {
        if (hasTime) {
          sharedCal.createEvent(title, startDate, endDate, { description: description });
        } else {
          sharedCal.createAllDayEvent(title, startDate, { description: description });
        }
      }
    } catch(e2) {
      Logger.log('공용 캘린더 등록 실패: ' + e2.message);
    }

  } catch(e) {
    Logger.log('캘린더 등록 실패: ' + e.message);
  }
}

// ============================================================
// [v11] 영수증 매월 1일 담당자 이메일 자동 발송
// GAS 트리거: 매월 1일 오전 9시
// ============================================================
function sendMonthlyReceiptEmail() {
  var now       = new Date();
  // 전월 계산
  var prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var yearMonth = Utilities.formatDate(prevMonth, 'Asia/Seoul', 'yyyy-MM');
  var ymLabel   = Utilities.formatDate(prevMonth, 'Asia/Seoul', 'yyyy년 M월');

  var ss        = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh        = ss.getSheetByName(HL_SH.RECEIPT);
  if (!sh || sh.getLastRow() < 2) return;

  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 13).getValues();

  // 담당자별 그룹핑
  var staffMap = {};
  for (var i = 0; i < data.length; i++) {
    var row     = data[i];
    var rawDate = row[0];
    var rowDate = '';
    if (rawDate instanceof Date) {
      rowDate = Utilities.formatDate(rawDate, 'Asia/Seoul', 'yyyy-MM-dd');
    } else {
      rowDate = String(rawDate || '').slice(0, 10);
    }
    if (!rowDate.startsWith(yearMonth)) continue;

    var email = String(row[2] || '').trim();
    var name  = String(row[1] || '').trim();
    if (!email) continue;

    if (!staffMap[email]) {
      staffMap[email] = { name: name, email: email, rows: [], total: 0 };
    }
    var amount = parseInt(String(row[3] || '0').replace(/[^0-9]/g,''), 10) || 0;
    staffMap[email].rows.push({
      date:       rowDate,
      amount:     amount,
      memo:       String(row[4] || ''),
      payMethod:  String(row[5] || ''),
      subCat1:    String(row[6] || ''),
      subCat2:    String(row[7] || ''),
      detailMemo: String(row[8] || ''),
      fileUrl:    String(row[11] || ''),
    });
    staffMap[email].total += amount;
  }

  // 각 담당자에게 메일 발송
  for (var email in staffMap) {
    var staff = staffMap[email];
    var rows  = staff.rows;
    if (rows.length === 0) continue;

    var tableRows = rows.map(function(r) {
      return '<tr>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #eee;">' + r.date + '</td>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #eee;">' + r.payMethod + '</td>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #eee;">' + r.subCat1 + (r.subCat2?' > '+r.subCat2:'') + '</td>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">' + (parseInt(r.amount,10)||0).toLocaleString() + '원</td>'
        + '<td style="padding:6px 10px;border-bottom:1px solid #eee;">' + (r.detailMemo||r.memo) + '</td>'
        + '</tr>';
    }).join('');

    var html = '<div style="font-family:\'Apple SD Gothic Neo\',sans-serif;max-width:680px;margin:0 auto;">'
      + '<div style="background:#1a56db;color:#fff;padding:24px 28px;border-radius:12px 12px 0 0;">'
      + '<h2 style="margin:0;font-size:20px;">🧾 ' + ymLabel + ' 영수증 내역</h2>'
      + '<p style="margin:8px 0 0;opacity:.85;font-size:14px;">' + staff.name + ' 님의 지출 내역을 안내드립니다.</p>'
      + '</div>'
      + '<div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px;">'
      + '<p style="font-size:22px;font-weight:700;color:#1a56db;margin:0 0 20px;">'
      + '합계: ' + staff.total.toLocaleString() + '원 (' + rows.length + '건)</p>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
      + '<thead><tr style="background:#f3f4f6;">'
      + '<th style="padding:8px 10px;text-align:left;">날짜</th>'
      + '<th style="padding:8px 10px;text-align:left;">결제수단</th>'
      + '<th style="padding:8px 10px;text-align:left;">분류</th>'
      + '<th style="padding:8px 10px;text-align:right;">금액</th>'
      + '<th style="padding:8px 10px;text-align:left;">메모</th>'
      + '</tr></thead>'
      + '<tbody>' + tableRows + '</tbody>'
      + '</table>'
      + '<p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">본 메일은 현장관리시스템 시스템에서 자동 발송됩니다.</p>'
      + '</div></div>';

    GmailApp.sendEmail(
      staff.email,
      '[현장관리시스템] ' + ymLabel + ' 영수증 내역 (' + staff.name + ')',
      ymLabel + ' 영수증 ' + rows.length + '건, 합계 ' + staff.total.toLocaleString() + '원',
      { htmlBody: html, name: '현장관리시스템 시스템' }
    );
  }
}

// ── 매월 1일 트리거 등록 함수 (최초 1회 실행)
// Apps Script 편집기에서 수동으로 한 번 실행하세요.
function setupMonthlyTrigger() {
  // 기존 트리거 삭제
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendMonthlyReceiptEmail') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // 매월 1일 오전 9시 트리거 등록
  ScriptApp.newTrigger('sendMonthlyReceiptEmail')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();
  Logger.log('✅ 매월 1일 오전 9시 트리거 등록 완료');
}


// ══════════════════════════════════════════════════════════════════════
// v12 추가 기능 — [기능1] 사진 교체 / [기능3] 서비스확인서
// ══════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────
// [기능1] 사진 교체 — handleReplacePhoto
// payload: { sheetType, rowIndex, fileIdCol, fileNameCol, fileUrlCol,
//            oldFileId, newFileBase64, newFileName, newMimeType, folderHint }
// ──────────────────────────────────────────────────────────────────────
function handleReplacePhoto(payload) {
  try {
    var sheetType   = String(payload.sheetType    || 'custom').trim();
    var rowIndex    = parseInt(payload.rowIndex    || 0, 10);
    var oldFileId   = String(payload.oldFileId    || '').trim();
    var b64         = String(payload.newFileBase64 || '').trim();
    var newFileName = String(payload.newFileName   || 'photo_replaced.jpg').trim();
    var newMimeType = String(payload.newMimeType   || 'image/jpeg').trim();
    var folderHint  = String(payload.folderHint   || '').trim();

    if (!b64)         return _err_('newFileBase64 필수');
    if (rowIndex < 2) return _err_('rowIndex 는 2 이상');

    var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
    var sh, fileIdCol, fileNameCol, fileUrlCol;

    if (sheetType === 'receipt') {
      sh          = _ensureReceiptSheet_();
      fileIdCol   = parseInt(payload.fileIdCol   || 10, 10);
      fileNameCol = parseInt(payload.fileNameCol || 11, 10);
      fileUrlCol  = parseInt(payload.fileUrlCol  || 12, 10);
    } else if (sheetType === 'domestic') {
      sh          = _getDomesticSheet_(ss);
      fileIdCol   = parseInt(payload.fileIdCol   || 28, 10);
      fileNameCol = parseInt(payload.fileNameCol || 0,  10);
      fileUrlCol  = parseInt(payload.fileUrlCol  || 28, 10);
    } else if (sheetType === 'cs') {
      sh          = ss.getSheetByName(HL_SH.CS);
      fileIdCol   = parseInt(payload.fileIdCol   || 20, 10);
      fileNameCol = parseInt(payload.fileNameCol || 0,  10);
      fileUrlCol  = parseInt(payload.fileUrlCol  || 20, 10);
    } else {
      var customName = String(payload.sheetName || '').trim();
      if (!customName) return _err_('sheetType=custom 이면 sheetName 필수');
      sh          = ss.getSheetByName(customName);
      fileIdCol   = parseInt(payload.fileIdCol,   10);
      fileNameCol = parseInt(payload.fileNameCol, 10);
      fileUrlCol  = parseInt(payload.fileUrlCol,  10);
    }
    if (!sh) return _err_('시트 없음');

    // Drive 폴더 결정
    var folder;
    if (folderHint.indexOf('receipt_') === 0) {
      var parts = folderHint.split('_');
      folder = _getReceiptFolder_(parts[1] || 'unknown', parts[2] || Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM'));
    } else {
      folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
    }

    // 새 파일 업로드
    var blob    = Utilities.newBlob(Utilities.base64Decode(b64), newMimeType, newFileName);
    var newFile = folder.createFile(blob);
    newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var newFileId  = newFile.getId();
    var newFileUrl = 'https://drive.google.com/uc?export=view&id=' + newFileId;

    // 시트 업데이트
    sh.getRange(rowIndex, fileUrlCol).setValue(newFileUrl);
    if (fileIdCol   > 0) sh.getRange(rowIndex, fileIdCol).setValue(newFileId);
    if (fileNameCol > 0) sh.getRange(rowIndex, fileNameCol).setValue(newFileName);
    SpreadsheetApp.flush();

    // 기존 파일 휴지통
    if (oldFileId) {
      try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch(e) {}
    }
    return _ok_({ newFileId: newFileId, newFileUrl: newFileUrl });
  } catch(e) {
    return _err_('사진 교체 실패: ' + e.message);
  }
}


// ──────────────────────────────────────────────────────────────────────
// [기능3] 서비스확인서 시트명 & 헤더
// ──────────────────────────────────────────────────────────────────────
var SVC_REPORT_SHEET   = '점검 서비스 확인서';
var SVC_REPORT_HEADERS = [
  '작성일자','병원명','제품명','모델명','서버번호','시스템타입',
  '고객이름','고객연락처','설치장소','점검일자','정기점검결과','보안환경결과',
  '특이사항','다음점검예정일','점검자명','점검자서명URL','고객서명URL','PDF_URL',
  '담당자이메일','등록시각'
];

function _ensureSvcReportSheet_() {
  var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
  var sh = ss.getSheetByName(SVC_REPORT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SVC_REPORT_SHEET);
    sh.getRange(1, 1, 1, SVC_REPORT_HEADERS.length).setValues([SVC_REPORT_HEADERS]);
    sh.getRange(1, 1, 1, SVC_REPORT_HEADERS.length)
      .setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
    sh.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sh;
}

function _safeParseJson_(val) {
  try { return val ? JSON.parse(val) : {}; } catch(e) { return {}; }
}

// ── 서비스확인서 목록 조회
function handleGetServiceReports(params) {
  try {
    var email     = String((params && params.email)     || '').trim().toLowerCase();
    var hospital  = String((params && params.hospital)  || '').trim();
    var yearMonth = String((params && params.yearMonth) || '').trim();

    var sh = _ensureSvcReportSheet_();
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return _ok_([]);

    var data = sh.getRange(2, 1, lastRow - 1, 20).getValues();
    var result = [];
    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var rowEmail    = String(r[18] || '').trim().toLowerCase();
      var rowHospital = String(r[1]  || '').trim();
      var rowDate     = String(r[0]  || '').trim();
      if (email    && rowEmail    !== email)              continue;
      if (hospital && rowHospital !== hospital)           continue;
      if (yearMonth && rowDate.slice(0,7) !== yearMonth) continue;
      result.push({
        rowIndex:       i + 2,
        작성일자:       rowDate,
        병원명:         rowHospital,
        제품명:         String(r[2]  || ''),
        모델명:         String(r[3]  || ''),
        서버번호:       String(r[4]  || ''),
        시스템타입:     String(r[5]  || ''),
        고객이름:       String(r[6]  || ''),
        고객연락처:     String(r[7]  || ''),
        설치장소:       String(r[8]  || ''),
        점검일자:       String(r[9]  || ''),
        정기점검결과:   _safeParseJson_(r[10]),
        보안환경결과:   _safeParseJson_(r[11]),
        특이사항:       _safeParseJson_(r[12]),
        다음점검예정일: String(r[13] || ''),
        점검자명:       String(r[14] || ''),
        점검자서명URL:  String(r[15] || ''),
        고객서명URL:    String(r[16] || ''),
        pdfUrl:         String(r[17] || ''),
        담당자이메일:   rowEmail,
      });
    }
    return _ok_(result);
  } catch(e) {
    return _err_('서비스확인서 조회 실패: ' + e.message);
  }
}

// ── 서비스확인서 생성
function handleCreateServiceReport(payload) {
  try {
    var email    = String(payload.email  || '').trim().toLowerCase();
    var hospital = String(payload.병원명 || '').trim();
    if (!hospital) return _err_('병원명 필수');

    var today  = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
    var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);

    // 서명 이미지 Drive 업로드
    var inspSignUrl = '', custSignUrl = '';
    if (payload.점검자서명Base64) {
      var inspB64 = payload.점검자서명Base64.replace(/^data:image\/\w+;base64,/, '');
      var inspFile = folder.createFile(
        Utilities.newBlob(Utilities.base64Decode(inspB64), 'image/png', 'sign_insp_' + hospital + '_' + today + '.png')
      );
      inspFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      inspSignUrl = 'https://drive.google.com/uc?export=view&id=' + inspFile.getId();
    }
    if (payload.고객서명Base64) {
      var custB64 = payload.고객서명Base64.replace(/^data:image\/\w+;base64,/, '');
      var custFile = folder.createFile(
        Utilities.newBlob(Utilities.base64Decode(custB64), 'image/png', 'sign_cust_' + hospital + '_' + today + '.png')
      );
      custFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      custSignUrl = 'https://drive.google.com/uc?export=view&id=' + custFile.getId();
    }

    var sh     = _ensureSvcReportSheet_();
    var newRow = sh.getLastRow() + 1;
    var rowData = [
      today, hospital,
      String(payload.제품명         || ''), String(payload.모델명         || ''),
      String(payload.서버번호       || ''), String(payload.시스템타입     || ''),
      String(payload.고객이름       || ''), String(payload.고객연락처     || ''),
      String(payload.설치장소       || ''), String(payload.점검일자       || today),
      JSON.stringify(payload.정기점검결과 || {}),
      JSON.stringify(payload.보안환경결과 || {}),
      JSON.stringify(payload.특이사항    || []),
      String(payload.다음점검예정일 || ''), String(payload.점검자명       || ''),
      inspSignUrl, custSignUrl, '',
      email,
      Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss'),
    ];
    sh.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    SpreadsheetApp.flush();
    return _ok_({ rowIndex: newRow, 점검자서명URL: inspSignUrl, 고객서명URL: custSignUrl });
  } catch(e) {
    return _err_('서비스확인서 생성 실패: ' + e.message);
  }
}

// ── 서비스확인서 PDF 생성
function handleGenerateServiceReportPDF(payload) {
  try {
    var rowIndex = parseInt(payload.rowIndex || 0, 10);
    if (rowIndex < 2) return _err_('rowIndex 필수');

    var sh   = _ensureSvcReportSheet_();
    var data = sh.getRange(rowIndex, 1, 1, 20).getValues()[0];

    var hospital    = String(data[1]  || '');
    var product     = String(data[2]  || '');
    var model       = String(data[3]  || '');
    var serverNo    = String(data[4]  || '');
    var sysType     = String(data[5]  || '');
    var custName    = String(data[6]  || '');
    var custPhone   = String(data[7]  || '');
    var location    = String(data[8]  || '');
    var inspDate    = String(data[9]  || '');
    var insResults  = _safeParseJson_(data[10]);
    var secResults  = _safeParseJson_(data[11]);
    var issuesRaw   = _safeParseJson_(data[12]);
    var issues      = Array.isArray(issuesRaw) ? issuesRaw : [];
    var nextDate    = String(data[13] || '');
    var inspector   = String(data[14] || '');
    var inspSignUrl = String(data[15] || '');
    var custSignUrl = String(data[16] || '');
    var today       = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');

    var doc  = DocumentApp.create('_tmp_svcreport_' + hospital + '_' + today);
    var body = doc.getBody();
    body.setPageWidth(595.28).setPageHeight(841.89);
    body.setMarginTop(45).setMarginBottom(45).setMarginLeft(50).setMarginRight(50);

    // 제목
    var ttl = body.appendParagraph('정기점검 서비스확인서');
    ttl.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    ttl.editAsText().setFontSize(22).setBold(true).setForegroundColor('#1e3a5f');
    body.appendParagraph('');

    // 1. 기본정보
    _svcTitle_(body, '1. 기본정보');
    var infoTable = body.appendTable([
      ['병원명', hospital,  '고객 이름',   custName ],
      ['제품명', product,   '고객 연락처', custPhone],
      ['모델명', model,     '설치장소',    location ],
      ['서버 번호', serverNo, '점검일자',  inspDate ],
      ['타입',  sysType,   '',            ''        ],
    ]);
    _styleInfo_(infoTable);
    body.appendParagraph('');

    // 2. 정기점검항목
    _svcTitle_(body, '2. 정기점검항목 (P: Pass / F: Fail / N: N/A)');
    var INS_ITEMS = ['소프트웨어 버전 확인','서버/클라이언트 정상 동작','네트워크 연결 상태',
      '제품 실행 및 분석 기능','PACS 리포트 전송','로그 및 오류 이력 확인','데이터 백업 상태','라이선스 유효성'];
    var insRows = [['평가항목','평가결과']];
    for (var ii = 0; ii < INS_ITEMS.length; ii++) insRows.push([INS_ITEMS[ii], String(insResults[INS_ITEMS[ii]] || 'N')]);
    insRows.push(['종합판정', String(insResults['종합판정'] || '')]);
    _styleCheck_(body.appendTable(insRows));
    body.appendParagraph('');

    // 3. 보안환경점검
    _svcTitle_(body, '3. 보안환경점검 (P: Pass / F: Fail / N: N/A)');
    var SEC_ITEMS = ['서버실 출입 통제','네트워크 분리 여부','바이러스 백신 운용','계정 및 접근권한 관리'];
    var secRows = [['평가항목','평가결과']];
    for (var si = 0; si < SEC_ITEMS.length; si++) secRows.push([SEC_ITEMS[si], String(secResults[SEC_ITEMS[si]] || 'N')]);
    secRows.push(['종합판정', String(secResults['종합판정'] || '')]);
    _styleCheck_(body.appendTable(secRows));
    body.appendParagraph('');

    // 4. 특이사항
    _svcTitle_(body, '4. 특이사항 및 조치내용');
    var issRows = [['문제 항목','조치 내용','비고']];
    if (issues.length === 0) { issRows.push(['없음','','']); }
    else { for (var isi = 0; isi < issues.length; isi++) issRows.push([String(issues[isi].문제항목||''),String(issues[isi].조치내용||''),String(issues[isi].비고||'')]); }
    _styleCheck_(body.appendTable(issRows));
    body.appendParagraph('');

    // 5. 다음점검예정일
    _svcTitle_(body, '5. 다음점검예정일');
    body.appendTable([['다음 점검 예정일', nextDate]]);
    body.appendParagraph('');

    // 6. 점검자 확인
    _svcTitle_(body, '6. 점검자 확인');
    var inspTable = body.appendTable([['소속','점검자 성명','점검일자','서명'],['휴런', inspector, inspDate, '']]);
    _styleCheck_(inspTable);
    if (inspSignUrl) {
      try {
        var inspId = inspSignUrl.replace('https://drive.google.com/uc?export=view&id=', '');
        inspTable.getRow(1).getCell(3).clear().appendImage(DriveApp.getFileById(inspId).getBlob()).setWidth(80).setHeight(40);
      } catch(eI) {}
    }
    body.appendParagraph('');

    // 7. 고객 확인
    _svcTitle_(body, '7. 고객 확인');
    var custTable = body.appendTable([['고객 성함','직책','확인일자','서명'],[custName, '', today, '']]);
    _styleCheck_(custTable);
    if (custSignUrl) {
      try {
        var custId = custSignUrl.replace('https://drive.google.com/uc?export=view&id=', '');
        custTable.getRow(1).getCell(3).clear().appendImage(DriveApp.getFileById(custId).getBlob()).setWidth(80).setHeight(40);
      } catch(eC) {}
    }

    // PDF 내보내기
    doc.saveAndClose();
    var docId   = doc.getId();
    var token   = ScriptApp.getOAuthToken();
    var pdfResp = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + docId + '/export?mimeType=application/pdf',
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
    );
    try { DriveApp.getFileById(docId).setTrashed(true); } catch(e2) {}

    if (pdfResp.getResponseCode() !== 200) throw new Error('PDF export 실패 HTTP ' + pdfResp.getResponseCode());

    var pdfName = today + '_' + hospital + '_서비스확인서.docx';
    var pdfFile = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(
      pdfResp.getBlob().setName(pdfName).setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    );
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var pdfUrl = 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view';

    sh.getRange(rowIndex, 18).setValue(pdfUrl); // R열: 문서_URL
    SpreadsheetApp.flush();
    return _ok_({ pdfUrl: pdfUrl, fileName: pdfName });
  } catch(e) {
    return _err_('서비스확인서 PDF 생성 실패: ' + e.message);
  }
}

// ── PDF 헬퍼
function _svcTitle_(body, text) {
  body.appendParagraph(text).editAsText().setFontSize(11).setBold(true).setForegroundColor('#1e3a5f');
}
function _styleInfo_(table) {
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var c = 0; c < row.getNumCells(); c++) {
      row.getCell(c).editAsText().setFontSize(10);
      if (c % 2 === 0) { row.getCell(c).setBackgroundColor('#e8edf5').editAsText().setBold(true); }
    }
  }
}
function _styleCheck_(table) {
  var hrow = table.getRow(0);
  for (var c = 0; c < hrow.getNumCells(); c++) {
    hrow.getCell(c).setBackgroundColor('#1e3a5f').editAsText().setFontSize(10).setBold(true).setForegroundColor('#ffffff');
  }
  for (var r = 1; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var ci = 0; ci < row.getNumCells(); ci++) row.getCell(ci).editAsText().setFontSize(10);
  }
}

// ══════════════════════════════════════════════════════════════════
// handleSendServiceReportEmail — 서비스확인서 PDF를 고객 이메일로 발송
// ══════════════════════════════════════════════════════════════════
function handleSendServiceReportEmail(p) {
  try {
    var custEmail  = p.custEmail  || '';
    var pdfUrl     = p.pdfUrl     || '';
    var 병원명     = p.병원명     || '';
    var 점검유형   = p.점검유형   || '점검';
    var 점검일자   = p.점검일자   || '';
    var 점검자명   = p.점검자명   || '';

    if (!custEmail) return _err_('고객 이메일이 없습니다.');
    if (!pdfUrl)    return _err_('PDF URL이 없습니다.');

    var subject = '[휴런] ' + 병원명 + ' ' + 점검유형 + ' 서비스확인서 (' + 점검일자 + ')';

    var body = '안녕하세요.\n\n'
      + 병원명 + ' ' + 점검유형 + ' 서비스확인서를 보내드립니다.\n\n'
      + '■ 점검일자: ' + 점검일자 + '\n'
      + '■ 점검유형: ' + 점검유형 + '\n'
      + '■ 점검자: ' + 점검자명 + ' (휴런)\n\n'
      + '■ 서비스확인서 문서(Word):\n' + pdfUrl + '\n\n'
      + '감사합니다.\n휴런 TE팀 드림';

    var htmlBody = '<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;max-width:600px;margin:0 auto;">'
      + '<div style="background:#1e3a5f;padding:24px 28px;">'
      + '<h2 style="color:#fff;margin:0;font-size:18px;">📋 점검 서비스확인서</h2></div>'
      + '<div style="padding:28px;background:#f8fafc;">'
      + '<p style="color:#374151;font-size:15px;">안녕하세요,<br><strong>' + 병원명 + '</strong> ' + 점검유형 + ' 서비스확인서를 보내드립니다.</p>'
      + '<table style="width:100%;border-collapse:collapse;margin:20px 0;">'
      + '<tr><td style="padding:8px 12px;background:#e8edf5;font-weight:bold;width:120px;border:1px solid #d1d5db;">점검일자</td>'
      + '<td style="padding:8px 12px;border:1px solid #d1d5db;">' + 점검일자 + '</td></tr>'
      + '<tr><td style="padding:8px 12px;background:#e8edf5;font-weight:bold;border:1px solid #d1d5db;">점검유형</td>'
      + '<td style="padding:8px 12px;border:1px solid #d1d5db;">' + 점검유형 + '</td></tr>'
      + '<tr><td style="padding:8px 12px;background:#e8edf5;font-weight:bold;border:1px solid #d1d5db;">점검자</td>'
      + '<td style="padding:8px 12px;border:1px solid #d1d5db;">' + 점검자명 + ' (휴런)</td></tr>'
      + '</table>'
      + '<div style="text-align:center;margin:28px 0;">'
      + '<a href="' + pdfUrl + '" style="display:inline-block;background:#1e3a5f;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">📄 서비스확인서 PDF 보기</a>'
      + '</div>'
      + '<p style="color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:16px;">본 이메일은 휴런 현장관리시스템 시스템에서 자동 발송되었습니다.<br>문의: ' + 점검자명 + ' · 휴런 TE팀</p>'
      + '</div></div>';

    GmailApp.sendEmail(custEmail, subject, body, {
      htmlBody: htmlBody,
      name: '휴런 TE팀 (' + 점검자명 + ')',
    });

    return _ok_({ sent: true, to: custEmail });
  } catch (err) {
    return _err_('이메일 발송 실패: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
// 설치환경 정보요청서 핸들러
// ══════════════════════════════════════════════════════════════════
function _ensureInstallSheet_() {
  var ss = SpreadsheetApp.openById('1IZ-dn_kqkjtnpMHGR3v7rBC4nWhDYKyDaA54sTeC2vQ');
  var name = '설치환경 정보요청서 데이터';
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(['No','등록일시','병원명','연동방식','TE담당자','영업담당자','교육검토','상태','JSON데이터','PDF URL']);
    sh.getRange(1,1,1,10).setBackground('#1e3a5f').setFontColor('#ffffff').setFontWeight('bold');
  }
  return sh;
}

function handleCreateInstallRequest(p) {
  try {
    var sh = _ensureInstallSheet_();
    var now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var row = [
      sh.getLastRow(),
      now,
      (p.A && p.A.병원명) || '',
      p.연동방식 || '',
      p.TE담당자명 || '',
      p.영업담당자명 || '',
      (p.E && p.E.교육검토) || '',
      '완료',
      JSON.stringify(p),
      ''
    ];
    sh.appendRow(row);
    var rowIndex = sh.getLastRow();

    // ── 🏥 제품현황_국내 자동 등록 ──────────────────────────────
    try {
      var ss = SpreadsheetApp.openById('1IZ-dn_kqkjtnpMHGR3v7rBC4nWhDYKyDaA54sTeC2vQ');
      var domesticSh = _getDomesticSheet_(ss);
      if (domesticSh) {
        var A = p.A || {}, C = p.C || {}, D1 = p.D1 || null, D2 = p.D2 || null;
        // 설치일정에서 시작일 추출 (YYYY-MM-DD ~ ... 형식)
        var installDateStr = (C.설치일정 || '').split('~')[0].trim();
        var installDate = installDateStr || now.split(' ')[0];
        // IP 추출: D1이면 첫 장비 IP, D2이면 PACS IP
        var ipAddr = '';
        if (D1 && Array.isArray(D1) && D1[0]) ipAddr = D1[0].ip || '';
        else if (D2) ipAddr = D2.PACSIP || '';
        // 연동방식 텍스트
        var linkMethodText = (p.연동방식 === 'D1') ? 'CT직접연동' : 'PACS경유연동';
        // 장비 제조사 (D1 첫번째 장비)
        var deviceMaker = (D1 && Array.isArray(D1) && D1[0]) ? (D1[0].maker || '') : '';
        // PACS 업체 (D2)
        var pacsVendor = D2 ? (D2.PACS제조사 || '') : '';
        // 사용자/담당자정보 (병원 기본 담당자)
        var userInfo = (A.담당자 || '') + (A.연락처 ? ' / ' + A.연락처 : '');
        // 제품유형 (On-premise / Cloud)
        var prodType = D2 ? (D2.설치환경 || 'On-premise') : 'On-premise';

        var lastRowNum = domesticSh.getLastRow();
        var newNo = lastRowNum; // 헤더 1행이므로 마지막행 번호 = 데이터행번호

        // 28컬럼 구조로 행 추가
        // [0]No [1]지역 [2]사이트이름 [3]설치유형 [4]계약유형 [5]제품유형
        // [6]제품명 [7]버전 [8]라이선스유형 [9]최초설치날짜 [10]만료일
        // [11]담당자 [12]IP [13]연동방식 [14]장비제조사 [15]상세연동내역
        // [16]사용자/담당자정보 [17]설치장소 [18]PACS업체 [19]원격가능
        // [20]관리코드 [21]설치확인서 [22]비고 [23] [24] [25]원격번호
        // [26]설치확인서첨부 [27]설치및셋팅사진경로
        var newRow = [
          newNo,                          // [0] No
          '',                             // [1] 지역 (주소에서 자동추출 어려움, 공란)
          A.병원명 || '',                 // [2] 사이트이름
          p.설치유형 || '납품',           // [3] 설치유형
          p.계약유형 || '정식',           // [4] 계약유형
          prodType,                       // [5] 제품유형
          p.제품명 || '',                 // [6] 제품명
          p.버전 || '',                   // [7] 버전
          '',                             // [8] 라이선스유형
          installDate,                    // [9] 최초설치날짜
          '',                             // [10] 만료일
          p.TE담당자명 || '',             // [11] 담당자
          ipAddr,                         // [12] IP주소
          linkMethodText,                 // [13] 연동방식
          deviceMaker,                    // [14] 장비제조사
          '',                             // [15] 상세연동내역
          userInfo,                       // [16] 사용자/담당자정보
          C.서버위치 || '',               // [17] 설치장소
          pacsVendor,                     // [18] PACS업체정보
          '',                             // [19] 원격가능
          '',                             // [20] 관리코드
          '',                             // [21] 설치확인서
          '',                             // [22] 비고
          '', '', '',                     // [23][24][25]
          '',                             // [26] 설치확인서첨부
          ''                              // [27] 설치및셋팅사진경로
        ];
        domesticSh.appendRow(newRow);
        var domesticRowIndex = domesticSh.getLastRow();
        return _ok_({ rowIndex: rowIndex, domesticRowIndex: domesticRowIndex, 제품현황등록: true });
      }
    } catch(e2) {
      // 제품현황 등록 실패해도 설치요청서는 저장됨
      Logger.log('제품현황 등록 실패: ' + e2.message);
    }

    return _ok_({ rowIndex: rowIndex, 제품현황등록: false });
  } catch(err) { return _err_(err.message); }
}

function handleGenerateInstallRequestPDF(p) {
  try {
    var rowIndex = p.rowIndex;
    var sh = _ensureInstallSheet_();
    var rowData = sh.getRange(rowIndex, 1, 1, 10).getValues()[0];
    var jsonStr = rowData[8];
    var d = JSON.parse(jsonStr);
    var A = d.A || {}, B = d.B || {}, C = d.C || {}, E_sec = d.E || {};

    // Google Doc 생성
    var docTitle = (A.병원명 || '병원') + '_설치환경정보요청서_' + (A.작성일 || '');
    var doc = DocumentApp.create(docTitle);
    var body = doc.getBody();
    body.setPageWidth(595).setPageHeight(842)
        .setMarginTop(36).setMarginBottom(36).setMarginLeft(50).setMarginRight(50);

    var titleStyle = {}; titleStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    titleStyle[DocumentApp.Attribute.BOLD] = true; titleStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
    var h2Style = {}; h2Style[DocumentApp.Attribute.FONT_SIZE] = 11; h2Style[DocumentApp.Attribute.BOLD] = true;
    var cellStyle = {}; cellStyle[DocumentApp.Attribute.FONT_SIZE] = 9;

    function addRow(table, label, value) {
      var row = table.appendTableRow();
      var c1 = row.appendTableCell(label); c1.setWidth(140); c1.editAsText().setFontSize(9).setBold(true);
      c1.setBackgroundColor('#e8edf5');
      var c2 = row.appendTableCell(value || ''); c2.editAsText().setFontSize(9);
    }

    // 제목
    body.appendParagraph('설치환경 정보요청서').setAttributes(titleStyle);
    body.appendParagraph('Installation Environment Information Request').setAttributes({[DocumentApp.Attribute.FONT_SIZE]:10,[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]:DocumentApp.HorizontalAlignment.CENTER,[DocumentApp.Attribute.FOREGROUND_COLOR]:'#6b7280'});
    body.appendParagraph('');

    // A
    body.appendParagraph('A. 병원 기본 정보').setAttributes(h2Style);
    var tA = body.appendTable(); tA.setBorderWidth(0.5);
    addRow(tA, '병원명', A.병원명); addRow(tA, '작성일', A.작성일);
    addRow(tA, '주소', A.주소); addRow(tA, '담당 부서', A.담당부서);
    addRow(tA, '담당자 성명', A.담당자); addRow(tA, '연락처', A.연락처); addRow(tA, '이메일', A.이메일);
    body.appendParagraph('');

    // B
    body.appendParagraph('B. 계약 및 행정 정보').setAttributes(h2Style);
    var tB = body.appendTable(); tB.setBorderWidth(0.5);
    addRow(tB,'계약 담당자 성명', B.계약담당자); addRow(tB,'직위/부서', B.직위부서);
    addRow(tB,'계약 담당자 연락처', B.연락처); addRow(tB,'이메일', B.이메일);
    addRow(tB,'NECA 신청서 담당자', B.NECA담당자 + (B.NECA연락처 ? ' / '+B.NECA연락처 : ''));
    addRow(tB,'NCCT 코드 생성 담당', B.NCCT담당자 + (B.NCCT부서 ? ' / '+B.NCCT부서 : ''));
    addRow(tB,'동의서 등록 담당', B.동의서담당자 + (B.동의서연락처 ? ' / '+B.동의서연락처 : ''));
    addRow(tB,'동의서 작성 대상', B.동의서인원);
    addRow(tB,'건수확인/계산서 담당', B.계산서담당자 + (B.계산서연락처 ? ' / '+B.계산서연락처 : ''));
    addRow(tB,'계약서 수령 담당', B.계약서담당자 + (B.계약서연락처 ? ' / '+B.계약서연락처 : ''));
    body.appendParagraph('');

    // C
    body.appendParagraph('C. 설치 장소 및 운영 환경').setAttributes(h2Style);
    var tC = body.appendTable(); tC.setBorderWidth(0.5);
    addRow(tC,'서버 설치 위치', C.서버위치); addRow(tC,'담당 부서', C.IT부서);
    addRow(tC,'전산 담당자', C.IT담당자 + (C.IT연락처 ? ' / '+C.IT연락처 : ''));
    addRow(tC,'네트워크 담당자', C.네트워크담당자 + (C.네트워크연락처 ? ' / '+C.네트워크연락처 : ''));
    addRow(tC,'PACS 담당자', C.PACS담당자 + (C.PACS연락처 ? ' / '+C.PACS연락처 : ''));
    addRow(tC,'희망 설치 일정', C.설치일정); addRow(tC,'가능 시간대', C.가능시간);
    addRow(tC,'설치 시 출입 절차', C.출입절차); addRow(tC,'사전 신청', C.사전신청);
    addRow(tC,'알람 서비스', C.알람서비스 + (C.알람연락처 ? ' / '+C.알람연락처 : ''));
    addRow(tC,'알람 수신 방법', C.알람수신방법);
    body.appendParagraph('');

    // 영업 서명
    body.appendParagraph('작성자 확인').setAttributes(h2Style);
    var tSign1 = body.appendTable(); tSign1.setBorderWidth(0.5);
    addRow(tSign1,'병원명', A.병원명); addRow(tSign1,'영업 담당자', d.영업담당자명 || '');
    body.appendParagraph('');

    // D 섹션
    if (d.연동방식 === 'D1' && d.D1) {
      body.appendParagraph('D-1. CT/MRI 장비 정보').setAttributes(h2Style);
      body.appendParagraph('※ 연동 방식에 따른 선택 항목 (CT/MRI 직접 연동)').setAttributes({[DocumentApp.Attribute.FONT_SIZE]:8,[DocumentApp.Attribute.FOREGROUND_COLOR]:'#6b7280'});
      var devices = d.D1;
      var hdr = ['구분','제조사','모델명','설치연도','설치위치','AE Title','IP주소','비고'];
      var tD1 = body.appendTable(); tD1.setBorderWidth(0.5);
      var hRow = tD1.appendTableRow();
      hdr.forEach(function(h){var c=hRow.appendTableCell(h);c.setBackgroundColor('#1e3a5f');c.editAsText().setFontSize(8).setBold(true).setForegroundColor('#ffffff');});
      var icons=['①','②','③'];
      devices.forEach(function(dev, i){
        var r=tD1.appendTableRow();
        [icons[i], dev.maker||'', dev.model||'', dev.year||'', dev.location||'', dev.aeTitle||'', dev.ip||'', dev.note||''].forEach(function(v){r.appendTableCell(v).editAsText().setFontSize(8);});
      });
    }

    if (d.연동방식 === 'D2' && d.D2) {
      body.appendParagraph('D-2. PACS 및 네트워크 환경').setAttributes(h2Style);
      body.appendParagraph('※ 연동 방식에 따른 선택 항목 (PACS 경유 연동)').setAttributes({[DocumentApp.Attribute.FONT_SIZE]:8,[DocumentApp.Attribute.FOREGROUND_COLOR]:'#6b7280'});
      var D2 = d.D2;
      var tD2 = body.appendTable(); tD2.setBorderWidth(0.5);
      addRow(tD2,'PACS 제조사', D2.PACS제조사); addRow(tD2,'PACS 버전', D2.PACS버전);
      addRow(tD2,'PACS IP 주소', D2.PACSIP); addRow(tD2,'PACS AE Title', D2.PACSAE);
      addRow(tD2,'HIS/EMR 연동', D2.HIS연동 + (D2.HIS제조사 ? ' / '+D2.HIS제조사 : ''));
      addRow(tD2,'외부 인터넷망', D2.인터넷); addRow(tD2,'방화벽 정책', D2.방화벽);
      addRow(tD2,'설치 환경', D2.설치환경); addRow(tD2,'특이사항', D2.특이사항||'');
    }
    body.appendParagraph('');

    // E
    body.appendParagraph('E. 교육 필요 확인 검토').setAttributes(h2Style);
    var tE = body.appendTable(); tE.setBorderWidth(0.5);
    addRow(tE,'교육검토', E_sec.교육검토||'');
    if (E_sec.교육검토 === '필요') {
      addRow(tE,'교육 대상 인원', E_sec.인원||''); addRow(tE,'교육 장소', E_sec.장소||'');
      addRow(tE,'교육 희망 일정', E_sec.일정||'');
      addRow(tE,'교육 담당', (E_sec.담당자||'') + (E_sec.연락처 ? ' / '+E_sec.연락처 : ''));
      addRow(tE,'교육 방식', E_sec.방식||'');
    }
    body.appendParagraph('');

    // TE 서명
    body.appendParagraph('회사 TE 담당자 확인').setAttributes(h2Style);
    var tSign2 = body.appendTable(); tSign2.setBorderWidth(0.5);
    addRow(tSign2,'병원명', A.병원명); addRow(tSign2,'TE 담당자', d.TE담당자명||'');
    addRow(tSign2,'이메일', d.TE이메일||'');

    doc.saveAndClose();

    // PDF 변환
    var fileId = doc.getId();
    var docxBlob = DriveApp.getFileById(fileId).getAs('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    var folderId = '1AcQxGvjJlyITS4KQwoVWbx-o64sr-wiw';
    var folder = DriveApp.getFolderById(folderId);
    var docxFile = folder.createFile(docxBlob.setName(docTitle + '.docx'));
    docxFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var pdfUrl = 'https://drive.google.com/file/d/' + docxFile.getId() + '/view';

    // 시트에 문서 URL 업데이트
    sh.getRange(rowIndex, 10).setValue(pdfUrl);

    // 임시 Doc 삭제
    DriveApp.getFileById(fileId).setTrashed(true);

    return _ok_({ pdfUrl: pdfUrl });
  } catch(err) { return _err_(err.message); }
}

// ============================================================
// 설치 및 운영 적격성 확인서 핸들러
// ============================================================
function handleCreateQualificationReport(p) {
  try {
    var ss = SpreadsheetApp.openById('1IZ-dn_kqkjtnpMHGR3v7rBC4nWhDYKyDaA54sTeC2vQ');
    var sheetName = '설치 및 운영 적격성 확인서';
    var sh = ss.getSheetByName(sheetName);
    if (!sh) {
      sh = ss.insertSheet(sheetName);
      sh.appendRow(['No','병원명','제품명','버전','UDI','시리얼번호','IP','타입','설치유형','설치장소',
                    '고객ID','고객연락처','작성자','작성일','작성자이메일',
                    '설치적격_서버PC','설치적격_클라이언트PC','설치적격_모니터','설치적격_네트워크','설치적격_인터넷',
                    '설치적격_매뉴얼','설치적격_라벨링','설치적격_무결성','설치적격_종합',
                    '운영적격_계정','운영적격_실행','운영적격_뷰어','운영적격_분석수동','운영적격_분석자동','운영적격_PACS','운영적격_종합',
                    '보안_출입통제','보안_CCTV','보안_잠금','보안_네트워크분리','보안_종합',
                    '특이사항','비고','사진URLs','PDF_URL','등록일시']);
    }
    var lastRow = sh.getLastRow();
    var no = lastRow < 2 ? 1 : (sh.getRange(lastRow, 1).getValue() || 0) + 1;

    // 사진 처리 → Drive 폴더 저장
    var photoUrls = [];
    var folderId = '1AcQxGvjJlyITS4KQwoVWbx-o64sr-wiw';
    var folder = DriveApp.getFolderById(folderId);
    var photos = p.photos || [];
    for (var i = 0; i < photos.length; i++) {
      var ph = photos[i];
      try {
        var blob = Utilities.newBlob(Utilities.base64Decode(ph.base64), ph.mimeType, ph.fileName);
        var ext = ph.fileName.split('.').pop() || 'jpg';
        var fname = (p.hospitalName||'병원') + '_적격확인서_' + (ph.category||'기타') + '_' + (i+1) + '.' + ext;
        var f = folder.createFile(blob.setName(fname));
        f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrls.push('https://drive.google.com/uc?export=view&id=' + f.getId() + '|' + (ph.category||'기타'));
      } catch(pe) { /* 개별 사진 실패 무시 */ }
    }

    // 특이사항 직렬화
    var issuesStr = '';
    try {
      var issArr = p.issues || [];
      issuesStr = issArr.filter(function(r){ return r.problem || r.action; })
                        .map(function(r){ return '['+r.problem+'] '+r.action; }).join('\n');
    } catch(e) { issuesStr = ''; }

    var ic = p.installChecks || {};
    var oc = p.opChecks || {};
    var sc = p.secChecks || {};
    var now = new Date();

    sh.appendRow([
      no,
      p.hospitalName||'', p.productName||'', p.version||'', p.udi||'', p.serialNo||'',
      p.ip||'', p.deviceType||'', p.installType||'', p.location||'',
      p.custId||'', p.custPhone||'',
      p.writerName||'', p.writeDate||'', p.writerEmail||'',
      ic.serverPC||'', ic.clientPC||'', ic.monitor||'', ic.network||'', ic.internet||'',
      ic.manual||'', ic.labeling||'', ic.integrity||'', p.installVerdict||'',
      oc.account||'', oc.launch||'', oc.viewer||'', oc.analysisManual||'', oc.analysisAuto||'', oc.pacsReport||'', p.opVerdict||'',
      sc.access||'', sc.cctv||'', sc.lock||'', sc.netSeg||'', p.secVerdict||'',
      issuesStr, p.remarks||'',
      photoUrls.join('\n'),
      '', // PDF URL 나중에 업데이트
      now
    ]);

    var rowIndex = sh.getLastRow();
    return _ok_({ rowIndex: rowIndex, photoCount: photoUrls.length });
  } catch(err) { return _err_(err.message); }
}

function handleGenerateQualificationPDF(p) {
  try {
    var rowIndex = p.rowIndex || 0;
    var hospitalName = p.hospitalName || '';
    var productName  = p.productName  || '';

    // Google Docs 생성
    var docTitle = (p.writeDate||'') + '_' + hospitalName + '_' + (productName||'적격확인서') + '_설치운영적격확인서';
    var doc  = DocumentApp.create(docTitle);
    var body = doc.getBody();
    body.setMarginTop(36).setMarginBottom(36).setMarginLeft(54).setMarginRight(54);

    var titleStyle = {};
    titleStyle[DocumentApp.Attribute.FONT_SIZE] = 14;
    titleStyle[DocumentApp.Attribute.BOLD] = true;
    titleStyle[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] = DocumentApp.HorizontalAlignment.CENTER;
    var h2Style = {};
    h2Style[DocumentApp.Attribute.FONT_SIZE] = 10;
    h2Style[DocumentApp.Attribute.BOLD] = true;
    h2Style[DocumentApp.Attribute.FOREGROUND_COLOR] = '#1e3a5f';

    function addRow2(table, c1txt, c2txt) {
      var row = table.appendTableRow();
      var c1 = row.appendTableCell(c1txt);
      c1.setWidth(140); c1.editAsText().setFontSize(9).setBold(true);
      c1.setBackgroundColor('#e8edf5');
      var c2 = row.appendTableCell(c2txt || '');
      c2.editAsText().setFontSize(9);
    }

    // 타이틀
    body.appendParagraph('설치 및 운영 적격성 확인서').setAttributes(titleStyle);
    body.appendParagraph('Installation & Operation Qualification Report').setAttributes({
      [DocumentApp.Attribute.FONT_SIZE]: 9,
      [DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]: DocumentApp.HorizontalAlignment.CENTER,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#6b7280'
    });
    body.appendParagraph('');

    // 기본 정보
    body.appendParagraph('기본 정보').setAttributes(h2Style);
    var tBase = body.appendTable(); tBase.setBorderWidth(0.5);
    addRow2(tBase, '병원명',           hospitalName);
    addRow2(tBase, '제품명',           productName);
    addRow2(tBase, '버전',             p.version||'');
    addRow2(tBase, 'UDI 정보',        p.udi||'');
    addRow2(tBase, '시리얼 번호',      p.serialNo||'');
    addRow2(tBase, '접속 정보(IP)',    p.ip||'');
    addRow2(tBase, '타입',             p.deviceType||'');
    addRow2(tBase, '설치 유형',        p.installType||'');
    addRow2(tBase, '설치 장소',        p.location||'');
    addRow2(tBase, '고객 ID(담당)',    p.custId||'');
    addRow2(tBase, '고객 연락처',      p.custPhone||'');
    addRow2(tBase, '작성자',           p.writerName||'');
    addRow2(tBase, '작성일',           p.writeDate||'');
    body.appendParagraph('');

    // 설치 적격성
    body.appendParagraph('설치 적격성 평가 결과 (P: Pass, F: Fail, N: N/A)').setAttributes(h2Style);
    var tInstall = body.appendTable(); tInstall.setBorderWidth(0.5);
    var ihdr = tInstall.appendTableRow();
    ['평가항목','결과'].forEach(function(h){ var c=ihdr.appendTableCell(h); c.setBackgroundColor('#1e3a5f'); c.editAsText().setFontSize(9).setBold(true).setForegroundColor('#ffffff'); });
    var ic = p.installChecks || {};
    [['서버 PC 정상동작 확인', ic.serverPC||''],
     ['클라이언트 PC 정상 동작 확인', ic.clientPC||''],
     ['모니터 정상 출력', ic.monitor||''],
     ['네트워크 정상 확인', ic.network||''],
     ['인터넷 가능 여부', ic.internet||''],
     ['사용자 매뉴얼 제공 확인', ic.manual||''],
     ['제품정보(라벨링) 확인', ic.labeling||''],
     ['무결성 검증', ic.integrity||'']
    ].forEach(function(row){
      var r = tInstall.appendTableRow();
      r.appendTableCell(row[0]).editAsText().setFontSize(9);
      var vc = r.appendTableCell(row[1]); vc.editAsText().setFontSize(9).setBold(true);
      if (row[1]==='P') vc.setBackgroundColor('#d1fae5');
      else if (row[1]==='F') vc.setBackgroundColor('#fee2e2');
    });
    var iVerdRow = tInstall.appendTableRow();
    iVerdRow.appendTableCell('종합판정').editAsText().setFontSize(9).setBold(true);
    var iVC = iVerdRow.appendTableCell(p.installVerdict||''); iVC.editAsText().setFontSize(10).setBold(true);
    if (p.installVerdict==='Pass') iVC.setBackgroundColor('#d1fae5'); else iVC.setBackgroundColor('#fee2e2');
    body.appendParagraph('');

    // 운영 적격성
    body.appendParagraph('운영 적격성 평가 결과 (P: Pass, F: Fail, N: N/A)').setAttributes(h2Style);
    var tOp = body.appendTable(); tOp.setBorderWidth(0.5);
    var ohdr = tOp.appendTableRow();
    ['평가항목','결과'].forEach(function(h){ var c=ohdr.appendTableCell(h); c.setBackgroundColor('#1e3a5f'); c.editAsText().setFontSize(9).setBold(true).setForegroundColor('#ffffff'); });
    var oc = p.opChecks || {};
    [['계정생성 여부', oc.account||''],
     ['제품 실행 여부', oc.launch||''],
     ['뷰어 표시 여부', oc.viewer||''],
     ['분석정상여부(수동)', oc.analysisManual||''],
     ['분석정상여부(자동)', oc.analysisAuto||''],
     ['PACS 리포트 전송 여부', oc.pacsReport||'']
    ].forEach(function(row){
      var r = tOp.appendTableRow();
      r.appendTableCell(row[0]).editAsText().setFontSize(9);
      var vc = r.appendTableCell(row[1]); vc.editAsText().setFontSize(9).setBold(true);
      if (row[1]==='P') vc.setBackgroundColor('#d1fae5');
      else if (row[1]==='F') vc.setBackgroundColor('#fee2e2');
    });
    var oVerdRow = tOp.appendTableRow();
    oVerdRow.appendTableCell('종합판정').editAsText().setFontSize(9).setBold(true);
    var oVC = oVerdRow.appendTableCell(p.opVerdict||''); oVC.editAsText().setFontSize(10).setBold(true);
    if (p.opVerdict==='Pass') oVC.setBackgroundColor('#d1fae5'); else oVC.setBackgroundColor('#fee2e2');
    body.appendParagraph('');

    // 보안환경
    body.appendParagraph('물리적·기술적 보안 환경 점검 결과 (P: Pass, F: Fail)').setAttributes(h2Style);
    var tSec = body.appendTable(); tSec.setBorderWidth(0.5);
    var shdr = tSec.appendTableRow();
    ['평가항목','결과'].forEach(function(h){ var c=shdr.appendTableCell(h); c.setBackgroundColor('#1e3a5f'); c.editAsText().setFontSize(9).setBold(true).setForegroundColor('#ffffff'); });
    var sc = p.secChecks || {};
    [['서버실/운영실 출입통제 여부', sc.access||''],
     ['CCTV, 출입기록 관리', sc.cctv||''],
     ['장비의 잠금 보호조치 여부', sc.lock||''],
     ['네트워크 분리 구조 확인', sc.netSeg||'']
    ].forEach(function(row){
      var r = tSec.appendTableRow();
      r.appendTableCell(row[0]).editAsText().setFontSize(9);
      var vc = r.appendTableCell(row[1]); vc.editAsText().setFontSize(9).setBold(true);
      if (row[1]==='P') vc.setBackgroundColor('#d1fae5');
      else if (row[1]==='F') vc.setBackgroundColor('#fee2e2');
    });
    var sVerdRow = tSec.appendTableRow();
    sVerdRow.appendTableCell('종합판정').editAsText().setFontSize(9).setBold(true);
    var sVC = sVerdRow.appendTableCell(p.secVerdict||''); sVC.editAsText().setFontSize(10).setBold(true);
    if (p.secVerdict==='Pass') sVC.setBackgroundColor('#d1fae5'); else sVC.setBackgroundColor('#fee2e2');
    body.appendParagraph('');

    // 특이사항
    body.appendParagraph('특이사항 및 조치내용').setAttributes(h2Style);
    var tIssue = body.appendTable(); tIssue.setBorderWidth(0.5);
    var issHdr = tIssue.appendTableRow();
    ['문제 항목','조치 내용'].forEach(function(h){ var c=issHdr.appendTableCell(h); c.setBackgroundColor('#1e3a5f'); c.editAsText().setFontSize(9).setBold(true).setForegroundColor('#ffffff'); });
    var issues = p.issues || [];
    if (issues.length === 0) issues = [{problem:'',action:''}];
    issues.forEach(function(row){
      var r = tIssue.appendTableRow();
      r.appendTableCell(row.problem||'').editAsText().setFontSize(9);
      r.appendTableCell(row.action||'').editAsText().setFontSize(9);
    });
    body.appendParagraph('');

    // 비고
    body.appendParagraph('비고').setAttributes(h2Style);
    var tRem = body.appendTable(); tRem.setBorderWidth(0.5);
    tRem.appendTableRow().appendTableCell(p.remarks||'').editAsText().setFontSize(9);
    body.appendParagraph('');

    // 서명란
    body.appendParagraph('확인').setAttributes(h2Style);
    var tSign = body.appendTable(); tSign.setBorderWidth(0.5);
    addRow2(tSign, '작성자 (TE 담당)', (p.writerName||'') + '  /  ' + (p.writeDate||''));
    body.appendParagraph('');
    body.appendParagraph('F702-07-03  /  (주)휴런').setAttributes({
      [DocumentApp.Attribute.FONT_SIZE]: 8,
      [DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]: DocumentApp.HorizontalAlignment.RIGHT,
      [DocumentApp.Attribute.FOREGROUND_COLOR]: '#9ca3af'
    });

    doc.saveAndClose();

    // PDF 변환 → Drive 폴더 저장
    var folderId = '1AcQxGvjJlyITS4KQwoVWbx-o64sr-wiw';
    var folder = DriveApp.getFolderById(folderId);
    var docxBlob = DriveApp.getFileById(doc.getId()).getAs('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    var docxFile = folder.createFile(docxBlob.setName(docTitle + '.docx'));
    docxFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var pdfUrl = 'https://drive.google.com/file/d/' + docxFile.getId() + '/view';

    // 이력 시트에 PDF URL 업데이트
    if (rowIndex >= 2) {
      var ss2 = SpreadsheetApp.openById('1IZ-dn_kqkjtnpMHGR3v7rBC4nWhDYKyDaA54sTeC2vQ');
      var sh2 = ss2.getSheetByName('설치 및 운영 적격성 확인서');
      if (sh2) sh2.getRange(rowIndex, 39).setValue(pdfUrl); // AO열 = PDF URL
    }

    // 임시 Docs 삭제
    DriveApp.getFileById(doc.getId()).setTrashed(true);

    return _ok_({ pdfUrl: pdfUrl, fileName: docTitle + '.docx' });
  } catch(err) { return _err_(err.message); }
}

// ============================================================
// 설치환경 정보요청서 — 영업/TE 역할 분리 핸들러
// ============================================================

// 영업: A+B+C+서명 저장 (상태: 영업완료, TE 대기)
function handleSaveInstallDraft(p) {
  try {
    var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
    var shName = '설치환경 정보요청서 데이터';
    var sh = ss.getSheetByName(shName);
    if (!sh) {
      sh = ss.insertSheet(shName);
      sh.appendRow(['No','병원명','작성일','영업담당자','영업이메일','주소','담당부서','담당자','연락처','이메일',
                    '계약담당자','PACS담당자','서버위치','IT담당자','IT연락처','네트워크담당자','네트워크연락처',
                    'PACS담당자2','PACS연락처','설치일정','가능시간','출입절차',
                    '제품명','버전','설치유형','계약유형',
                    '연동방식','D1_data','D2_data','E_data',
                    'TE담당자','TE이메일',
                    '상태','PDF_URL','등록일시']);
      sh.getRange(1,1,1,35).setBackground('#1e3a5f').setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    var lastRow = sh.getLastRow();
    var no = lastRow < 2 ? 1 : (sh.getRange(lastRow, 1).getValue() || 0) + 1;
    var A = p.A || {}; var B = p.B || {}; var C = p.C || {};
    sh.appendRow([
      no, A.병원명||'', A.작성일||'', p.영업담당자명||'', p.영업이메일||'',
      A.주소||'', A.담당부서||'', A.담당자||'', A.연락처||'', A.이메일||'',
      B.계약담당자||'', B.PACS담당자||'',
      C.서버위치||'', C.IT담당자||'', C.IT연락처||'',
      C.네트워크담당자||'', C.네트워크연락처||'',
      C.PACS담당자||'', C.PACS연락처||'',
      C.설치일정||'', C.가능시간||'', C.출입절차||'',
      p.제품명||'', p.버전||'', p.설치유형||'', p.계약유형||'',
      '', '', '', '',  // 연동방식~E: TE가 채움
      '', '',          // TE담당자/이메일
      '영업완료', '', new Date()
    ]);
    SpreadsheetApp.flush();
    return _ok_({ rowIndex: sh.getLastRow(), status: '영업완료' });
  } catch(err) { return _err_(err.message); }
}

// TE: 영업완료 목록 조회
function handleGetInstallDrafts(p) {
  try {
    var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
    var sh = ss.getSheetByName('설치환경 정보요청서 데이터');
    if (!sh || sh.getLastRow() < 2) return _ok_([]);
    var data = sh.getRange(2, 1, sh.getLastRow()-1, 35).getValues();
    var result = [];
    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][32] || '');
      if (status === '영업완료') {
        result.push({
          rowIndex: i + 2,
          no:          data[i][0],
          병원명:      data[i][1],
          작성일:      data[i][2],
          영업담당자:  data[i][3],
          제품명:      data[i][22],
          버전:        data[i][23],
          설치유형:    data[i][24],
          계약유형:    data[i][25],
          서버위치:    data[i][12],
          IT담당자:    data[i][13],
          IT연락처:    data[i][14],
          PACS담당자:  data[i][17],
          PACS연락처:  data[i][18],
          설치일정:    data[i][19],
          상태:        status,
        });
      }
    }
    return _ok_(result);
  } catch(err) { return _err_(err.message); }
}

// TE: D+E 이어서 저장 + PDF 생성
function handleContinueInstallRequest(p) {
  try {
    var ss = SpreadsheetApp.openById(현장관리시스템_SS_ID);
    var sh = ss.getSheetByName('설치환경 정보요청서 데이터');
    if (!sh) return _err_('설치환경 정보요청서 데이터 시트 없음');
    var rowIndex = p.rowIndex || 0;
    if (rowIndex < 2) return _err_('rowIndex 오류');

    // 연동방식/D1/D2/E/TE서명 업데이트
    sh.getRange(rowIndex, 27).setValue(p.연동방식||'');
    sh.getRange(rowIndex, 28).setValue(JSON.stringify(p.D1||[]));
    sh.getRange(rowIndex, 29).setValue(JSON.stringify(p.D2||{}));
    sh.getRange(rowIndex, 30).setValue(JSON.stringify(p.E||{}));
    sh.getRange(rowIndex, 31).setValue(p.TE담당자명||'');
    sh.getRange(rowIndex, 32).setValue(p.TE이메일||'');
    sh.getRange(rowIndex, 33).setValue('완료');
    SpreadsheetApp.flush();

    // 제품현황_국내 자동 등록 (기존 createInstallRequest와 동일 로직)
    try {
      var rowData = sh.getRange(rowIndex, 1, 1, 35).getValues()[0];
      var domesticSh = _getDomesticSheet_(ss);
      if (domesticSh) {
        var lastNo = domesticSh.getLastRow() < 2 ? 1 : (domesticSh.getRange(domesticSh.getLastRow(),1).getValue()||0)+1;
        var now2 = new Date();
        var newRow = new Array(28).fill('');
        newRow[0] = lastNo;
        newRow[2] = rowData[1];  // 병원명
        newRow[3] = rowData[24]; // 설치유형
        newRow[4] = rowData[25]; // 계약유형
        newRow[6] = rowData[22]; // 제품명
        newRow[7] = rowData[23]; // 버전
        newRow[9] = rowData[19]; // 설치일정
        newRow[11] = rowData[30];// TE담당자
        newRow[15] = rowData[26];// 연동방식
        newRow[17] = rowData[12];// 설치장소(서버위치)
        newRow[27] = now2;
        domesticSh.appendRow(newRow);
      }
    } catch(e2) { /* 제품현황 등록 실패해도 계속 */ }

    return _ok_({ rowIndex: rowIndex, status: '완료' });
  } catch(err) { return _err_(err.message); }
}
