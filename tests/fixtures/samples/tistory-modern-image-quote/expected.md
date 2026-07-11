---
title: MS 엣지(Edge) 브라우저 빙(Bing) 아이콘 제거하기
source: https://tame.tistory.com/816
blogKey: tistory
sourceId: tame.tistory.com
postId: 816
publishedAt: 2023-04-01T10:11:44+09:00
category: Uncategorized
categoryPath:
  - Uncategorized
thumbnail: https://blog.kakaocdn.net/dna/x7dUS/btr7eXpSDSG/AAAAAAAAAAAAAAAAAAAAAAom5jM8rmRxUJ027IVAUDLgRuDRe-G_zccexoYgLljd/img.png?credential=normalized
---

이번 MS 엣지(Edge) 브라우저 업데이트로 화면 우측 상단에 보이는 빙(Bing) 검색 아이콘을 제거하는 방법입니다.

![](https://blog.kakaocdn.net/dna/x7dUS/btr7eXpSDSG/AAAAAAAAAAAAAAAAAAAAAAom5jM8rmRxUJ027IVAUDLgRuDRe-G_zccexoYgLljd/img.png?credential=normalized)

빙(Bing) 아이콘 제거하기

1. 우측 하단의 '시작' 아이콘 클릭.
2. 'Windows 시스템 - 명령 프롬프트' 에서 우클릭 후 관리자 권한으로 실행 선택.

![](https://blog.kakaocdn.net/dna/y1exg/btr7gi0ZjdW/AAAAAAAAAAAAAAAAAAAAALOUYdUe4XsgL5Zzto4zXRAHW6WesL3C_RwiQCpPQLHA/img.png?credential=normalized)

3. 아래 명령어를 복사하여 붙여 넣기 후 엔터.

- 레지스트리에 빙(Bing) 아이콘 제거 항목이 추가 됩니다.

> Reg.exe add "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v "HubsSidebarEnabled" /t REG_DWORD /d "0" /f

![](https://blog.kakaocdn.net/dna/biDDdl/btr7gx4XSsz/AAAAAAAAAAAAAAAAAAAAAIiwKjOcC-EEcW0WMoZRy0583XFhyDPnK3dcSkLPSUhs/img.png?credential=normalized)

4. MS 엣지(Edge) 브라우저 실행하면 빙(Bing) 아이콘이 위 그림과 같이 제거 됨을 확인 할수 있습니다.

☞ 빙(Bing) 아이콘을 다시 나타나게 하려면 아래 명령어를 입력해 추가한 레지스트리를 삭제하면 됩니다.

> Reg.exe delete "HKLM\SOFTWARE\Policies\Microsoft\Edge" /v "HubsSidebarEnabled"

더보기

> - 뉴 MS 엣지(Edge): PDF 파일 다운로드 또는 열기- 뉴 MS 엣지(Edge): 오프라인 설치하기- 뉴 MS 엣지(Edge): 브라우저에 저장된 암호(Password) 확인하기- 뉴 MS 엣지(Edge): 엣지 닫혔을 때 백그라운드 앱 실행 정지하기- 뉴 MS 엣지(Edge): 팝업 차단/허용 설정하기- 뉴 MS 엣지(Edge): 업데이트(Update) 하기

> - MS 엣지(Edge): 크로미움(Chromium) 정식 버전 출시- MS 엣지(Edge): 크로미움(Chromium) 버전 공개

> - MS 엣지(Edge): 즐겨찾기(Favorites) 백업/복원 하기- MS 엣지(Edge): 속도 향상 시키기 - TCP Fast Open- MS 엣지(Edge): 텝 미리보기 기능 사용하지 않기- MS 엣지(Edge): 확장기능(Extensions) 사용하기- MS 엣지(Edge): 기본 다운로드 위치 변경하기- MS 엣지(Edge): 기본 브라우저로 IE11 사용하기- MS 엣지(Edge): 'IE11에서 열기' 페이지 보이지 않게 하기- MS 엣지(Edge): 즐겨찾기(Favorites) 위치- MS 엣지(Edge): 기본 검색 엔진 변경하기
