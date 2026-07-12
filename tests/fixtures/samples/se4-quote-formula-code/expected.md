---
title: "[DP] Slope trick 공부 - BOJ - 19693 Safety"
source: https://blog.naver.com/mym0404/222619228134
blogKey: naver
sourceId: mym0404
postId: 222619228134
publishedAt: 2022-01-11T22:53:03+09:00
category: PS 알고리즘, 팁
categoryPath:
  - Algorithm
  - PS 알고리즘, 팁
thumbnail: https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMzAw/MDAxNjQxOTAxMTY4NDI2.8akcjgeR4eBygaw-Aos4qS9Cl4K__Ms3xswjHEAWggAg.01-4GR4fCm4rUK_ywMmkcYx0mpoZMbdA_ooLeMIuxPEg.PNG.mym0404/bg.png?type=w
---

[19693번: Safety](https://www.acmicpc.net/problem/19693)
문제 Squeaky the Mouse has recently gained an appreciation for the visual arts, and is now attempting his own work of art to be put on display in the most prestigious visual arts festival in town. His artwork consists of many stacks of similar-sized illuminated cubes arranged to form a line. More prec...

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMTY4/MDAxNjQxOTAxMTc3MjAz.ViBkLBNHFFOYqzck1bULr7POLSjGzjXSe15Z74ytJXAg.HSfsBacZhWB6f4EjGF0IbdzoNTiDojX__2EoUJs34wMg.PNG.mym0404/image.png?type=w)

---

어저께부터 Slope trick을 공부하고 있는데, relation이 딱 정해져 있어서 점화식을 세우고 Monotonicity 같은 트징을 찾으면 적용할 수 있는 DP 최적화 기법들인 Convex hull trick, D&C Opt, Knuth Opt 등보다 정말 이해하기도 어렵고 난해하다.

기본문제부터 다이아 3을 찍고가는 이유가 있다.

아직 Slope trick에 대해 뭔가 글을 쓸 이해도도 안되기 때문에 이 문제를 접근하고 푸는 과정을 다시 곱씹으며 이해도를 높혀보려 한다.

이 글을 Slope trick을 처음 배우는데 공부할 용도로 쓸 순 없을 것이다. 나도 아직 이해를 해가는 과정이기 때문에 이론이 불완전한 부분이 있을 수 있다.

> Description & Relation

일단 이 문제에서 요구하는 것은 대개 Slope trick 문제가 그러듯이 단순하다.

1번째부터 N번째 까지 수열을 주고 인접한 수의 차이가 H 이하가 되도록 수열을 변경하고 싶은데, 각 수를 1 증가시키거나 감소시키는 연산을 유한히 수행할 때, 최소 연산 횟수를 구하는 문제이다.

나는 Slope trick을 배우기 전에 이런류 문제의 description을 접해보며 Slope trick이란건 대충 어감만 생각했을 때 이런 류 문제들에서 뭐 인접한 수들의 기울기를 어떻게 해서 사용하는 DP 최적화인가? 생각했었다.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfNzIg/MDAxNjQxOTAxNDc0NjQy.J6MfdTT6gGSBNVoRceIhAGY1T-fg-mK3m9kTLB_tnuUg.vwfc7LopfVUKohz28RJx742Ol-uRm--nEUwibhAswkEg.PNG.mym0404/image.png?type=w)

알고보니 그딴게 아니고 전혀 딴것이였다.

DP 점화식을 다음과 같이 정의해보자.

$$
dp\left(i,\ x\right)\ =\ a_i\ 를\ x로\ 만들\ 때\ 0\ \sim \ i-1\ 까지\ 모두
$$

이는 다음과 같다는걸 알 수 있다.

$$
dp\left(i,\ x\right)=|\ a_i-x\ |+Min_{x-H\le k\le x+H}\ dp\left(i-1,\ k\right)
$$

| a\_i - x | 는 항상 더해지는 값이다. a\_i 를 x 까지 만드는데 필요한 연산 횟수이기 때문에 자명하다.

$$
Min_{x-H\le k\le x+H}\ dp\left(i-1,\ k\right)
$$

부분은 잠시뒤에 어떻게 연산이 되는지 살펴본다.

> Visuallization

이것이 실제 xy 좌표평면에서 어떻게 그려지는지 살펴보자.

일단 i = 0 부터이다.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMjA2/MDAxNjQxOTA1OTcxNzYy.1W46zLLoOdIEILUW_tBBKo5Rkhy_kgqjrM0UBRkZ8EQg.aMRk5Qyx_TeNXPoJ8-PZXVTi3Tbo40sG2nUIDpp7IMMg.PNG.mym0404/image.png?type=w)

이제 i = 1 을 보자.

$$
dp\left(i,\ x\right)=|\ a_i-x\ |+Min_{x-H\le k\le x+H}\ dp\left(i-1,\ k\right)
$$

식은 단순히 a\_1 에서 위와 같이 v 자로 그려지는 함수와 **dp(i - 1, k) 에서 모든 x 좌표에 대해 +- H 범위 이내의 최소값을 가져오는 함수의 합**이라고 볼 수 있다.

실제로 어떻게 그려지는지 보자. 일단 뒤에 Min 부분 부터 본다.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMTMw/MDAxNjQxOTA2Mjg5Mzg3.Tuf9fdkMJfvHWR1gYopxSuOKkF0oIxBx33pI4KIWxRsg.cbFqKpOXP_6PjP_mrcGQL4rWMIze-zN67ZR207AdLwIg.PNG.mym0404/image.png?type=w)

주황색이 새롭게 그려진 그래프이다. a\_0 - H 부터 a\_0 + H 구간은 a\_0 이 이전 함수에서 0이였기 때문에 H 이하로 차이나는 구간에서 최소값이 항상 0이다.

그리고 다른 함수 개형들도 모두 a\_0 좌우로 -H, +H 씩 옮겨지는 것을 주목하자.

이제 | a\_1 - x | 함수를 더해보자.

여기선 세 가지 경우가 있다.

$$
1.\ a_1>a_0+H
$$

두 경우는 대칭적으로 동일한 연산을 수행하므로 1번 경우만 그려보고 넘어가자.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMTMx/MDAxNjQxOTA2NDg1NDc5.zM7VqWWtOOb92fAu4AOc0s85MF5ekTs-NculYu47i7Mg.Gi271TFUFPBsDLhogKyCv1PdWoqwVjE3twz0C7MgwfEg.PNG.mym0404/image.png?type=w)

주황색과 초록색 그래프가 더해져 새로운 dp(1, x) 그래프가 형성이 된 모습이다.

일단 이렇게 개형이 그려진다는 것만 알고 다음 경우로 넘어간다.

$$
3.\ a_0-H\le a_1\le a_0+H
$$

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMjgz/MDAxNjQxOTA2NjUyODYz.JLt2lbX6WPqut79kAkrm5OuL9yaRBDwQjb8a9kuxxhog.UiDy1ZqLrTU8PMI7a8OzxR-ZMEuhB5lpLikv1NqEEWYg.PNG.mym0404/image.png?type=w)

그림이 조금 더러운데, 결국 새로 생긴 그래프 개형은 빨간색 dp(1, x) 그래프이다.

이 경우엔 dp(1, x) 의 최소값(정답)이 dp(0, x)에서의 최소값과 달라지지 않았음을 확인할 수 있다.

> Idea

결국 우리가 앞선 그래프 개형이 그려지는 꼴로 보았듯이, 뭔가 정답이 되는 구간은 그래프의 기울기가 0이거나 아래로 뾰족한 지점이 된다는 것을 알 수 있다.

그렇다면 이러한 구간의 왼쪽 끝과 오른쪽 끝을 계속해서 유지시키면서 간다면 뭔가 현재 a\_i 값에 대해 업데이트를 해주고 마지막까지 그 구간을 유지해서 정답이 되는 구간과 그 구간에서의 dp값을 얻어낼 수 있을 것 같다.

여기서 이제 x좌표에 따른 함수들의 기울기변화들만 집합(중복을 허용)으로 관리한다는 아이디어를 생각할 수 있다.

기울기가 변하는 구간들에 대해서 각각을 분리된 함수로 나타내지 않고, 기울기의 변화량들만 유지시키는 것이다.

실제로 위 그래프에서 어떻게 관리를 할 수 있는지 살펴본다.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMzgg/MDAxNjQxOTA3MDM3NjI4._C9uxz8BeReRQQdVQJD9Cz5XDgZinsDKvjEff05e13Eg.xaSD88O0yMOsPF_0xI1JO6za58UOvaMdoMBEUQj8F4og.PNG.mym0404/image.png?type=w)

여러 튜토리얼에서 이러한 집합의 정의를 약간씩 다르게 설정하는데, 결국 비슷하다.

기울기가 1씩 증가하는 x 좌표들을 모두 집합에 넣어둔다고 해보자. 1이 증가하면 한개를 넣고 2가 증가하면 두개를 넣어두는 식이다. 그럼 위의 그래프에서 {-3, 0, 0, 1} 과 같이 집합이 형성된 이유를 알 수 있다.

이제 우리는 한 가지 아이디어가 더 필요하다.

그래서 기울기가 0이 되는 구간을 어떻게 알아야 할지인데, 단순하게 기울기가 0에서 1이상으로 바뀌는 시점은 모두 집합에서 제거를 한다고 생각해보자.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfNzQg/MDAxNjQxOTA3MjM1MzM5.DcFAeOsHqXzqaIVf03hYqudPVMtTTTD8qiBU4eFyxosg.RupTjE9twBg1BlD_IjCkrBSt1Z9siDnu9AunuIYTdfwg.PNG.mym0404/image.png?type=w)

이 그래프는 항상 concave 하기 때문에 뭔가 a\_i 의 값이 추가될 때마다 위와 같이 가장 큰 x좌표부분이 기울기가 0이 되게 유지를 하면, O(1)에 가장 기울기가 작은 구간(우리의 정답이 되는 구간)에서 가장 작은 x좌표를 알 수 있다.

갑자기 뜬금없이 기울기가 0에 도달할 때 까지만 남기고 그 뒤 기울기 변화량은 버리는게 가능하냐고 생각할 수도 있다.

귀납적으로 생각해봤을 때, 이전 함수의 개형에서 집합에서 가장 x값이 큰 원소쪽은 기울기가 0이라고 하자.

| a\_i - x | 를 함수 개형에 더하는 행위는 집합에 a\_i 를 두 개를 삽입하는 과정과 같고,

a\_i 가 넣은 뒤에 집합에서 가장 큰 원소라면 a\_i 를 빼주거나 아니면 원래 가장컸던 녀석을 빼줌으로써 기울기 0을 관리하는게 가능하다.

이 부분에 관련해서 좀더 이해를 도와줄 동영상이 있다.

![Slope Trick Visualised](https://i.ytimg.com/vi/p8RxN6Y9OOA/hqdefault.jpg)
[Slope Trick Visualised](https://www.youtube.com/watch?v=p8RxN6Y9OOA)
This is a 3blue1brown styled slope trick tutorialKuroni's blog: https://codeforces.com/blog/entry/77298Problem discussed in the video: https://codeforces.com...

그러면 오른쪽 구간은 아예 안보는걸까? 아니다. 이 문제는 그렇게 풀 수 없고, 이러한 multiset을 두개를 관리하면 가능하다.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMTI4/MDAxNjQxOTA3NDgyMDQx.u2Cfk4zS5VCFcNiKsMGGeoO3nCc02cFkWKG6cAhpb_wg.bKT-cmS_8OFv7GR_pP_nrQNpu7hpQACU3KHBVje5woEg.PNG.mym0404/image.png?type=w)

그러면 이제 마지막으로 최소 구간을 기준으로 좌우로 계속 H씩 translation 되는것은 어떻게 처리할까?

offset을 관리하면 가능하다.

빨간색(왼쪽 집합)이 왼쪽으로 H 만큼 이동한다는 것은 f(i, x) 에서 f(i, x+H) 가 되는것과 같다. 반대도 마찬가지이다.

우리가 빨간색 집합에 0이라는 값을 넣고 k 번 -H를 더하는 연산을 진행한뒤에 나중에 꺼내서 보면 그건 여전히 0이지만 우린 꺼낸다음에 -kH 를 더해주어서 현재 그래프 개형에서 그 값이 의미하는 값을 얻어올 수 있다.

그리고 집합에 어떤 값을 넣어준다면 a\_i 에 kH 를 더한 값을 넣어준다. 현재 그래프는 왼쪽으로 kH 만큼 이동한 상태이기 때문에 a\_i 가 의미하는 값은 그만큼 더해져서 집합내 원소들과 비교가 되어야 적절하다.

> solve

이제 이 문제에서 실제로 값을 넣을때 두 집합이 어떻게 변화하는지 관찰하자.

정답은 0부터 시작한다.

왼쪽 집합에서 가장큰 값에 kH 를 뺀값을 L, 반대로 오른쪽 집합에서 가장 작은값에 kH를 더한값을 R 이라고 하자.

만약 a\_i 가 L과 R 사이에 들어간다면 위에서 언급했던 3번 경우이다.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMjgz/MDAxNjQxOTA2NjUyODYz.JLt2lbX6WPqut79kAkrm5OuL9yaRBDwQjb8a9kuxxhog.UiDy1ZqLrTU8PMI7a8OzxR-ZMEuhB5lpLikv1NqEEWYg.PNG.mym0404/image.png?type=w)

정답은 변하지 않으며 두 집합에 a\_i 를 적절히 translation 시켜서 넣어주면 된다.

1번 경우라서 R 보다 오른쪽이라고 하자.

![](https://mblogthumb-phinf.pstatic.net/MjAyMjAxMTFfMTMx/MDAxNjQxOTA2NDg1NDc5.zM7VqWWtOOb92fAu4AOc0s85MF5ekTs-NculYu47i7Mg.Gi271TFUFPBsDLhogKyCv1PdWoqwVjE3twz0C7MgwfEg.PNG.mym0404/image.png?type=w)

위의 상황에서 원래 L = a\_0 - H, R = a\_0 + H 이였는데, a\_1 이 R 보다 크다.

그러면 정답에 a\_1 - R 만큼 더해지게 되는것이 보인다.

그 후에 오른쪽 집합에 a\_1 - offset을 앞서 언급했듯이 두개 넣어준다.

원래 \[R, a\_1\] 구간의 기울기(주황색 그래프)가 1이였는데, 더해진 그래프에서 2가 되므로 R 부분을 집합에서 제거하면 위 빨간색 그래프와 동일한 개형이 나오게 된다.

(a1, inf) 부분도 마찬가지로 적절히 조절된다.

a\_i < L 인 경우도 위와 대칭적으로 구현해서 두 집합(실제 구현은 std::multiset이나 std::priority\_queue 를 이용) 를 관리해서 정답에 값들을 더해가며 최종 정답을 찾을 수 있다.

> code

```javascript
// sl = 왼쪽 함수, sr = 오른쪽 함수
void solve() {
   int n, h;
   cin >> n >> h;
   vi a(n);
   fv(a);
   multiset<int> sl, sr;
   sl.insert(a[0]), sr.insert(a[0]);
   int ans = 0;
   for (int i = 1; i < n; i++) {
      int offset = i * h;
      int l = *sl.rbegin() - offset;
      int r = *sr.begin() + offset;

      if (l <= a[i] && a[i] <= r) {
         sl.insert(a[i] + offset);
         sr.insert(a[i] - offset);
      } else if (a[i] < l) {
         ans += l - a[i];
         sl.insert(a[i] + offset);
         sl.insert(a[i] + offset);
         sl.erase(sl.find(l + offset));
         sr.insert(l - offset);
      } else if (a[i] > r) {
         ans += a[i] - r;
         sr.insert(a[i] - offset);
         sr.insert(a[i] - offset);
         sr.erase(sr.find(r - offset));
         sl.insert(r + offset);
      }
   }
   cout << ans;
}
```

---

[그래프 개형을 이용한 DP 최적화(slope trick)](https://jwvg0425-ps.tistory.com/98)
$N$개의 숫자로 이루어진 배열이 주어진다($N \le 3000$). 각 숫자는 $1$이상 $3000$ 이하의 정수다. 이 때, 한 번의 연산을 통해 배열에서 임의 위치의 숫자 값을 $1$ 증가시키거나 $1$ 감소시킬 수 있다. 연산을..
