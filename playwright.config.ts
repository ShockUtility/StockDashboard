import { defineConfig, devices } from '@playwright/test';

/**
 * [교육용 주석] Playwright E2E 테스트의 전반적인 환경 설정을 정의하는 파일입니다.
 * 이 설정을 바탕으로 어떤 브라우저에서 테스트할지, 로컬 서버를 자동으로 띄울지 등을 결정합니다.
 */
export default defineConfig({
  // 테스트 파일들이 위치할 디렉토리를 지정합니다.
  testDir: './tests',
  
  // 하나의 테스트 케이스(it, test)가 실행될 때 허용되는 최대 시간 (30초)
  // 외부 API 호출 등으로 응답이 늦어질 수 있으므로 30초로 설정합니다.
  timeout: 30 * 1000,
  
  // expect() 단언문(검증 단계)이 성공할 때까지 대기하는 시간 (5초)
  expect: {
    timeout: 5000,
  },
  
  // 테스트 파일들을 병렬로 동시에 실행할지 여부입니다.
  // 이 프로젝트는 실제 API를 호출하며 상태(포트폴리오 생성 등)가 공유되거나 영향을 미칠 수 있으므로
  // 안정적인 순차 테스트를 위해 false로 설정합니다.
  fullyParallel: false,
  
  // CI 환경이 아닌 로컬 개발 환경에서는 실패 시 재시도(retry)를 하지 않도록 설정합니다.
  retries: 0,
  
  // 테스트 완료 후 결과를 브라우저에서 시각적으로 볼 수 있는 HTML 보고서 형식으로 출력합니다.
  reporter: 'html',
  
  // 모든 테스트 케이스에서 공통으로 적용할 브라우저 동작 옵션입니다.
  use: {
    // 테스트할 대상 웹 애플리케이션의 기본 주소입니다.
    // page.goto('/')를 호출하면 자동으로 http://localhost:3000/ 으로 이동합니다.
    baseURL: 'http://localhost:3000',
    
    // 테스트 실패 시에만 디버깅용 실행 추적 로그(Trace)를 남기도록 설정합니다.
    trace: 'on-first-retry',
    
    // 브라우저 창의 기본 해상도(크기)를 1280x720으로 지정합니다.
    viewport: { width: 1280, height: 720 },
  },

  // 테스트를 수행할 웹 브라우저 프로젝트 목록입니다.
  // 여기서는 크롬 기반의 Chromium 환경만 사용하도록 구성했습니다.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // [교육용 주석] 테스트 실행 시 로컬 개발 서버를 자동으로 확인하고 실행해주는 기능입니다.
  // 이미 사용자가 터미널에서 'npm run dev' 등으로 서버를 띄워 놓은 상태라면,
  // 해당 서버를 그대로 재사용(reuseExistingServer: true)하여 신속하게 테스트를 시작합니다.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120 * 1000, // 서버가 기동될 때까지 대기하는 최대 시간 (2분)
  },
});
