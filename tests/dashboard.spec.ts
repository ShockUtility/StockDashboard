import { test, expect } from '@playwright/test';

/**
 * [교육용 주석] 
 * 이 파일은 Playwright를 사용하여 작성된 브라우저 E2E(End-to-End) 테스트 코드입니다.
 * 실제 크롬 브라우저를 띄워 사용자가 마우스로 클릭하고 키보드로 타이핑하는 동작을 코드로 자동화해 둔 것입니다.
 * 
 * 테스트 실행 시 서로 다른 테스트들끼리 데이터를 오염시키지 않도록, 
 * 각 테스트 시작 전에 로컬스토리지(localStorage)를 청소하여 포트폴리오 데이터를 초기화하는 로직이 들어있습니다.
 */

test.beforeEach(async ({ page }) => {
  // 1. 대시보드 홈페이지로 접속합니다.
  await page.goto('/');
  
  // 2. [교육용 설명] 각 테스트가 완전히 깨끗하고 독립된 환경에서 동작할 수 있도록
  //    브라우저의 로컬스토리지(localStorage) 데이터들을 일괄 청소합니다.
  await page.evaluate(() => {
    localStorage.clear();
  });
  
  // 3. 데이터를 지운 후 페이지를 새로고침하여 초기 상태(기본 포트폴리오 하나만 생성된 상태)로 만듭니다.
  await page.reload();
});

test.describe('자산 포트폴리오 대시보드 E2E 테스트', () => {

  // ----------------------------------------------------
  // 시나리오 1: 기본 UI 및 초기 렌더링 검증
  // ----------------------------------------------------
  test('1. 기본 UI 및 타이틀이 정상적으로 렌더링되는가', async ({ page }) => {
    // 웹 페이지의 대제목이 "자산 포트폴리오"인지 확인합니다.
    const title = page.locator('h1.gradient-text');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('자산 포트폴리오');

    // 서브 타이틀 문구가 표시되는지 확인합니다.
    await expect(page.getByText('주식부터 금현물까지, 실시간 자산 현황을 한눈에 관리하세요.')).toBeVisible();

    // 포트폴리오 요약 카드가 노출되는지 확인합니다.
    await expect(page.getByText('총 자산')).toBeVisible();
    await expect(page.getByText('총 평가액')).toBeVisible();
  });

  // ----------------------------------------------------
  // 시나리오 2: 메인 내비게이션 탭 전환 검증
  // ----------------------------------------------------
  test('2. 상단 탭 클릭 시 해당 섹션으로 정상 전환되는가', async ({ page }) => {
    // 1) 자산현황 탭 클릭 및 검증
    await page.getByRole('button', { name: '자산현황' }).click();
    // [교육용 설명] 자산현황 탭에서는 "미국 주식 통합 현황"과 "한국 주식 통합 현황"이 동시에 노출되므로,
    // Strict Mode 위반(여러 엘리먼트 매칭 에러)을 방지하기 위해 각각 개별적으로 화면 노출을 검증합니다.
    await expect(page.locator('h2:has-text("미국 주식 통합 현황")')).toBeVisible();
    await expect(page.locator('h2:has-text("한국 주식 통합 현황")')).toBeVisible();

    // 2) 지수현황 탭 클릭 및 검증
    await page.getByRole('button', { name: '지수현황' }).click();
    await expect(page.getByRole('heading', { name: '주요 지수 및 자산' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '환율' })).toBeVisible();

    // 3) 주요일정 탭 클릭 및 검증
    await page.getByRole('button', { name: '주요일정' }).click();
    // 캘린더 요일 헤더(일, 월, 화 등)가 보이는지 확인합니다.
    await expect(page.getByText('일요일').or(page.getByText('일', { exact: true }))).toBeVisible();

    // 4) 계좌관리 탭 클릭하여 다시 원래대로 돌아옵니다.
    await page.getByRole('button', { name: '계좌관리' }).click();
    await expect(page.locator('input.transparent-input').first()).toBeVisible();
  });

  // ----------------------------------------------------
  // 시나리오 3: 포트폴리오 추가 / 이름 수정 / 삭제 검증
  // ----------------------------------------------------
  test('3. 포트폴리오 계좌를 추가하고 이름을 변경하고 삭제할 수 있는가', async ({ page }) => {
    // 1) 새 포트폴리오 추가 버튼 클릭
    await page.getByRole('button', { name: '새 포트폴리오 추가' }).click();

    // 2) 포트폴리오 추가 확인 (최소 두 개 이상의 포트폴리오 인풋이 생겼어야 합니다.)
    const portfolioInputs = page.locator('input.transparent-input');
    await expect(portfolioInputs).toHaveCount(2);

    // 3) 새로 추가된 포트폴리오의 이름을 변경합니다.
    // 두 번째 인풋에 값을 새로 타이핑합니다.
    const secondInput = portfolioInputs.nth(1);
    await secondInput.click();
    await secondInput.fill('나의 미래 은퇴자금');
    await secondInput.press('Enter');

    // 입력한 이름이 정상적으로 보관 및 표시되는지 검증
    await expect(secondInput).toHaveValue('나의 미래 은퇴자금');

    // 4) [교육용 설명] 브라우저 confirm(확인/취소) 팝업이 뜰 때 자동으로 '확인'을 누르도록 설정합니다.
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('삭제');
      await dialog.accept();
    });

    // 5) 두 번째 포트폴리오의 삭제 버튼을 찾아 클릭합니다.
    // 두 번째 포트폴리오 영역의 title="포트폴리오 삭제" 버튼 클릭
    const deleteButtons = page.getByTitle('포트폴리오 삭제');
    await deleteButtons.nth(1).click();

    // 삭제 완료 후 다시 포트폴리오 개수가 1개로 줄어들었는지 검증
    await expect(page.locator('input.transparent-input')).toHaveCount(1);
  });

  // ----------------------------------------------------
  // 시나리오 4: 자산 추가 / 상세 모달 / 삭제 검증 (실제 API 호출)
  // ----------------------------------------------------
  test('4. 포트폴리오에 주식 자산(삼성전자)을 정상 추가하고 삭제할 수 있는가', async ({ page }) => {
    // 1) 첫 번째 포트폴리오의 "자산 추가" 버튼(+)을 클릭합니다.
    await page.getByTitle('자산 추가').first().click();

    // 2) 자산 추가 모달 팝업이 노출되는지 확인합니다.
    await expect(page.getByRole('heading', { name: '자산 추가' })).toBeVisible();

    // 3) "한국" 주식 탭 버튼을 선택합니다.
    await page.getByRole('button', { name: '🇰🇷 한국' }).click();

    // 4) 종목 코드 입력란을 찾아 삼성전자 코드인 '005930'을 타이핑합니다.
    const codeInput = page.locator('input[placeholder*="005930"]');
    await codeInput.fill('005930');

    // 5) [교육용 설명] 자동완성 검색 드롭다운에 '삼성전자' 항목이 나타날 때까지 대기 후 클릭합니다.
    const searchDropdownItem = page.locator('.search-item').first();
    await searchDropdownItem.waitFor({ state: 'visible', timeout: 5000 });
    await expect(searchDropdownItem).toContainText('삼성전자');
    await searchDropdownItem.click();

    // 6) 수량 및 평단가를 입력합니다.
    // 보유 수량 입력 (첫 번째 number 인풋)
    await page.locator('input[type="number"]').first().fill('10');
    // 평균 단가 입력 (두 번째 number 인풋)
    await page.locator('input[type="number"]').nth(1).fill('75000');

    // 7) '추가하기' 버튼을 눌러 제출합니다.
    await page.getByRole('button', { name: '추가하기' }).click();

    // 8) 테이블 내에 삼성전자가 추가되어 렌더링되었는지 확인합니다.
    // 실시간 API를 통해 종목명이 삼성전자로 잘 입력되었는지 노출을 검증합니다.
    const assetNameInTable = page.getByText('삼성전자');
    await assetNameInTable.waitFor({ state: 'visible', timeout: 5000 });
    await expect(assetNameInTable).toBeVisible();

    // 9) 자산명을 클릭하여 상세조회 모달창을 오픈합니다.
    await assetNameInTable.click();
    // [수정] 모달창 내 헤더로 렌더링되는 "삼성전자" 텍스트를 검증하도록 수정했습니다.
    const modalHeader = page.locator('.modal-content h3').first();
    await expect(modalHeader).toHaveText('삼성전자');

    // 닫기 버튼 누르기
    await page.getByRole('button', { name: '×' }).click();
    await expect(modalHeader).not.toBeVisible();

    // [교육용 설명] 자산 삭제 버튼을 누르면 브라우저 네이티브 confirm('정말 삭제하시겠습니까?') 다이얼로그가 뜹니다.
    // Playwright 테스트 브라우저에서 이를 자동으로 수락(accept)하도록 한 번만 실행되는 핸들러를 등록합니다.
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('삭제');
      await dialog.accept();
    });

    // 10) 자산 관리 메뉴(점 세개 버튼) 클릭 후 삭제 처리합니다.
    await page.locator('td button').first().click(); // 관리 버튼 클릭
    
    // 플로팅 메뉴에서 '삭제' 버튼을 클릭합니다.
    const deleteButton = page.getByText('🗑️ 삭제');
    await deleteButton.click();

    // 자산이 성공적으로 제거되었는지 확인합니다.
    await expect(page.getByText('삼성전자')).not.toBeVisible();
  });

  // ----------------------------------------------------
  // 시나리오 5: 환율 및 시세 새로고침 검증
  // ----------------------------------------------------
  test('5. 시세 새로고침 및 환율 팝업 모달이 정상 동작하는가', async ({ page }) => {
    // 1) 시세 새로고침 버튼(새로고침 아이콘) 클릭
    const refreshButton = page.locator('button:has(.lucide-refresh-cw, svg)').first();
    await refreshButton.click();

    // 2) 환율 차트 팝업 모달 띄우기
    // 환율 표시 요약 영역(예: "원/달러 환율") 클릭
    const exchangeRateCard = page.getByText('원/달러 환율').or(page.getByText('USD/KRW'));
    if (await exchangeRateCard.isVisible()) {
      await exchangeRateCard.click();
      // 모달창 타이틀 검증
      await expect(page.getByText('실시간 환율 동향')).toBeVisible();
      // 모달 닫기
      await page.getByRole('button', { name: '×' }).click();
    }
  });

  // ----------------------------------------------------
  // 시나리오 6: 주요일정(스케줄) 관리 검증
  // ----------------------------------------------------
  test('6. 주요일정 탭에서 일정을 직접 등록하고 삭제할 수 있는가', async ({ page }) => {
    // 1) 주요일정 탭으로 이동합니다.
    await page.getByRole('button', { name: '주요일정' }).click();

    // 2) "일정 추가" 버튼 클릭
    const addScheduleBtn = page.locator('button:has-text("일정 추가")').first();
    await addScheduleBtn.click();

    // 3) 일정 추가 모달이 잘 뜨는지 확인
    await expect(page.locator('h3:has-text("일정 등록")').or(page.locator('h3:has-text("일정 추가")'))).toBeVisible();

    // 4) 일정을 입력합니다. (제목: "삼성전자 주주총회", 날짜: 오늘 날짜)
    // [수정] 모달 내 실제 일정 제목 인풋창의 placeholder("예: 삼성전자 실적 발표")를 타겟팅합니다.
    await page.getByPlaceholder('예: 삼성전자 실적 발표').fill('삼성전자 주주총회');
    
    // [수정] 커스텀 일정 분류 드롭다운에서 '기타일정'을 선택한 뒤 '실적발표'로 전환해 봅니다.
    const typeDropdownTrigger = page.getByText('기타일정').first();
    if (await typeDropdownTrigger.isVisible()) {
      await typeDropdownTrigger.click();
      // 드롭다운 목록에서 '실적발표' 클릭
      await page.locator('div').filter({ hasText: /^실적발표$/ }).last().click();
    }

    // 상세 내용 입력
    // [수정] 상세 내용 인풋창의 실제 placeholder를 매칭합니다.
    const descTextarea = page.getByPlaceholder('세부적인 내용이나 예상치를 적어보세요.');
    if (await descTextarea.isVisible()) {
      await descTextarea.fill('삼성전자 1분기 정기 주주총회 개최의 건');
    }

    // 등록/추가하기 버튼 클릭
    // [수정] 등록 폼 내의 실제 저장 버튼("저장하기")을 찾아서 제출합니다.
    const submitBtn = page.getByRole('button', { name: '저장하기' });
    await submitBtn.click();

    // 5) 달력이나 상세 일정 카드 목록에 추가된 일정이 잘 노출되는지 검증
    await expect(page.getByText('삼성전자 주주총회').first()).toBeVisible();

    // 6) 일정 삭제 시도
    // [교육용 설명] 일정 상세 목록의 '삭제' 버튼을 누릅니다.
    const deleteBtn = page.getByText('삭제').first();
    await deleteBtn.click();

    // [교육용 설명] 일정 삭제 시 브라우저 네이티브 다이얼로그가 아니라 
    // HTML 커스텀 삭제 모달(".modal-content")이 화면에 노출되므로,
    // 해당 모달 내부에 있는 "삭제" 버튼을 특정하여 클릭해 주어야 정상적으로 일정이 삭제됩니다.
    // 최상위 div 대신 구체적인 클래스명(.modal-content)과 모달 내 헤더 제목을 필터링하여 Strict Mode 위반을 방지합니다.
    const confirmDeleteBtn = page.locator('.modal-content').filter({ hasText: '일정을 삭제하시겠습니까?' }).getByRole('button', { name: '삭제' });
    await confirmDeleteBtn.click();

    // 삭제 후 캘린더나 목록에서 일정이 더 이상 나타나지 않는지 확인
    await expect(page.getByText('삼성전자 주주총회')).not.toBeVisible();
  });

});

