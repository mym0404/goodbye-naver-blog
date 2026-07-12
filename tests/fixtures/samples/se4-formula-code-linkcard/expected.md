---
title: "[백준] 9942 하노이의 네 탑, 1607 원숭이 타워"
source: https://blog.naver.com/mym0404/223034929697
blogKey: naver
sourceId: mym0404
postId: 223034929697
publishedAt: 2023-03-04T22:38:22+09:00
category: BOJ
categoryPath:
  - Algorithm
  - BOJ
thumbnail: https://mblogthumb-phinf.pstatic.net/MjAyMzAzMDRfNTMg/MDAxNjc3OTM2NTg2NDU2.e5y0ziI9pO5MQMvTUNcVWLysAejftoYV5O83vFQAk3sg.aLBO_S1K-b4pQU0tOZ3ipv_r4uGR3BPXr8-gaT42riYg.PNG.mym0404/bg.png?type=w
---

[9942번: 하노이의 네 탑](https://www.acmicpc.net/problem/9942)
9942번 제출 맞힌 사람 숏코딩 재채점 결과 채점 현황 질문 게시판 하노이의 네 탑 다국어 시간 제한 메모리 제한 제출 정답 맞힌 사람 정답 비율 3 초 128 MB 724 204 151 32.059% 문제 하노이의 탑 이라는 유명한 문제가 있다. 하지만 이 문제는 너무 유명한 나머지 이제는 식상하다. 그러니까 이번엔 탑을 3개가 아닌 4개로 늘려서 생각해보자! N개의 원판과 4개의 막대가 있을 때, 즉 보조 막대가 한 개가 아닌 두 개이면 몇 번 움직여서 모든 원판을 끝의 원판으로 옮길 수 있을까? 4개의 막대를 이용해서 N개의...

[1607번: 원숭이 타워](https://www.acmicpc.net/problem/1607)
문제 동물원에서 막 탈출한 원숭이 한 마리가 세상구경을 하고 있다. 그는 자신이 원래 살던 곳으로 돌아가고 싶었지만 너무 멀어서 갈 수 없었다. 그래서 그는 자신이 살던 곳의 전통방식으로 지어진 탑을 간절히 생각하며 슬픔을 달래기로 했다. 그 탑의 이름은 원숭이 타워!! 원숭이 타워는 원숭이들이 만든 것이라고는 하지만 원숭이들의 창의력이 부족하여 실제로는 하노이지방의 하노이타워를 응용하여 만든 탑이다. 이제 그 탑을 살펴보자. 위의 그림에 잘 나타나있다. 원숭이 타워가 하노이타워와 다른 점은 기둥을 네 개를 쓴다는 점이다. 이 탑의...

![](https://mblogthumb-phinf.pstatic.net/MjAyMzAzMDRfMjcz/MDAxNjc3OTM2NjkzMzk1.dBw7P8v6syYqhX6uiGFtZYMxhRNu5AdLgy0ubMXc0o8g.NCYvjxO4oXkJt-ZuBNXDiROJWj-zxI7ibwoKHpoyOKog.PNG.mym0404/image.png?type=w)

---

두개가 같은 문제인데, 1607이 더 N이 크다.

일단 시간제한이 3초고 힌트를 직접 써서(?) 풀어야 하는 문제여서 난이도가 혼란스럽지만, 일단 하노이의 네 탑은 힌트를 안보고 풀었고 원숭이타워는 보고 풀었다.

사실 내가 구상한 내용이 위키피디아에 그대로 담겨있다.

[Tower of Hanoi - Wikipedia](https://en.wikipedia.org/wiki/Tower_of_Hanoi#With_four_pegs_and_beyond)
Tower of Hanoi 44 languages Article Talk Read Edit View history From Wikipedia, the free encyclopedia This article is about the mathematical disk game. For the card game, see Tower of Hanoy . For the Vietnamese skyscraper, see Keangnam Hanoi Landmark Tower . The Tower of Hanoi (also called The probl...

![](https://mblogthumb-phinf.pstatic.net/MjAyMzAzMDRfODIg/MDAxNjc3OTM2ODExOTUz.KMKddyWvqC4BsO3crGlb2jn_PCvvG45lNc-G3tmLRtYg.i2co4ajNSAqdrcvrRH8dBnPetfvNdwwkSvO8SfEFITwg.PNG.mym0404/image.png?type=w)

이제 파랑색 박스정도 까지 떠올렸고, 점화식을 세울 수 있었다.

$$
f\left(n\right)=MIN_{1\le k<n}\left\{f\left(k\right)+g\left(n-k\right)+f\left(k\right)\right\}
$$

f 가 원판이 4개 있을 때 옮기는 경우, g 가 3개 있을 때 옮기는 경우이다. g는 기존 하노이의 탑이므로 쉽게 구할 수 있다.

이제 관건은 k를 찾는것이였는데(어케 떠올리냐 저걸), 9942 문제는 N이 1000이라 O(N^2)에 적절히 k = n - 1 부터 내림차순으로 검사해주며 값이 더 커지는 순간의 k가 가장 최적의 k가 된다는 사실을 유추하여 풀 수 있었다.

```javascript
const ll mod = 9901;
inline ll md(ll x) { return md(mod, x); }
void solve() {
   int n, t = 1;

   vi g(1000001);
   g[1] = 1;
   for (int i = 2; i <= 1000000; i++) {
      g[i] = md(g[i - 1] * 2 + 1);
   }
   vi f(1000001);
   f[1] = 1;
   f[2] = 3;
   f[3] = 5;
   for (int i = 4; i <= 1000000; i++) {
      int k = i - round(sqrt(i * 2 + 1)) + 1;
      f[i] = md(f[k] * 2 + g[i - k]);
   }
   cin >> n;
   cout << f[n];
}
```
