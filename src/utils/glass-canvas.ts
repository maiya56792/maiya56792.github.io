/**
 * 玻璃雨窗 Canvas —— 首屏 hero 的交互层。
 *
 * 分三层叠加，从下到上：
 *   1. 背景图（DOM <img>，由 HeroGlass.astro 提供，Canvas 不负责绘制）
 *   2. 雾层（本 Canvas）：整片半透明白雾，鼠标拂过时用 destination-out 擦出通路，
 *      擦痕随时间缓慢恢复，模拟水汽重新凝结。
 *   3. 雨滴与涟漪（本 Canvas，画在雾层之上）
 *
 * 性能约束：
 *   - 离开视口即暂停 rAF（IntersectionObserver）
 *   - prefers-reduced-motion 或低端设备直接不启动，保留静态背景图
 *   - devicePixelRatio 上限 2，避免 4K 屏上过度绘制
 */

export interface GlassCanvasOptions {
	fogOpacity: number;
	eraseRadius: number;
	restoreSpeed: number;
	rainEnable: boolean;
	rainCount: number;
	rainSpeed: number;
	rippleEnable: boolean;
	rippleMaxCount: number;
}

interface Drop {
	x: number;
	y: number;
	len: number;
	vy: number;
	alpha: number;
}

interface Ripple {
	x: number;
	y: number;
	r: number;
	maxR: number;
	alpha: number;
}

const MAX_DPR = 2;

export function createGlassCanvas(
	canvas: HTMLCanvasElement,
	opts: GlassCanvasOptions,
): () => void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return () => {};

	// 低端设备/无障碍偏好：不启动动画，雾层也不绘制，直接露出清晰背景图
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
		.matches;
	const lowEnd =
		(navigator.hardwareConcurrency ?? 4) <= 2 ||
		window.matchMedia("(max-width: 640px)").matches;
	if (reduceMotion) return () => {};

	let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
	let w = 0;
	let h = 0;
	let rafId = 0;
	let running = false;

	const drops: Drop[] = [];
	const ripples: Ripple[] = [];
	// 擦除轨迹：记录鼠标经过的点，每点带一个存活度，存活度衰减即雾恢复
	const erases: { x: number; y: number; life: number }[] = [];

	let pointer: { x: number; y: number } | null = null;
	let lastPointer: { x: number; y: number } | null = null;

	// 移动端雨滴减半，涟漪上限收紧
	const rainCount = lowEnd ? Math.floor(opts.rainCount / 2) : opts.rainCount;
	const rippleMax = lowEnd ? 4 : opts.rippleMaxCount;

	function resize() {
		const rect = canvas.getBoundingClientRect();
		dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
		w = rect.width;
		h = rect.height;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		seedRain();
	}

	function seedRain() {
		drops.length = 0;
		if (!opts.rainEnable) return;
		for (let i = 0; i < rainCount; i++) {
			drops.push({
				x: Math.random() * w,
				y: Math.random() * h,
				len: 8 + Math.random() * 22,
				vy: (0.6 + Math.random() * 1.4) * opts.rainSpeed,
				alpha: 0.06 + Math.random() * 0.16,
			});
		}
	}

	function addRipple(x: number, y: number) {
		if (!opts.rippleEnable || ripples.length >= rippleMax) return;
		ripples.push({ x, y, r: 2, maxR: 40 + Math.random() * 40, alpha: 0.5 });
	}

	function drawFog() {
		// 雾层单独离屏合成：先铺满雾，再按擦除轨迹挖洞
		ctx.save();
		ctx.globalCompositeOperation = "source-over";
		const g = ctx.createLinearGradient(0, 0, 0, h);
		g.addColorStop(0, `rgba(228, 238, 250, ${opts.fogOpacity})`);
		g.addColorStop(0.55, `rgba(210, 226, 245, ${opts.fogOpacity * 0.92})`);
		g.addColorStop(1, `rgba(188, 208, 234, ${opts.fogOpacity * 0.98})`);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, w, h);

		// 挖洞：destination-out 把雾擦掉，露出下层背景图
		ctx.globalCompositeOperation = "destination-out";
		for (const e of erases) {
			const r = opts.eraseRadius * e.life;
			if (r <= 0.5) continue;
			const rg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
			// 边缘羽化，避免硬边像橡皮擦
			rg.addColorStop(0, `rgba(0,0,0,${0.92 * e.life})`);
			rg.addColorStop(0.6, `rgba(0,0,0,${0.5 * e.life})`);
			rg.addColorStop(1, "rgba(0,0,0,0)");
			ctx.fillStyle = rg;
			ctx.beginPath();
			ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}

	function drawRain() {
		if (!opts.rainEnable) return;
		ctx.save();
		ctx.strokeStyle = "rgba(255,255,255,1)";
		ctx.lineWidth = 1;
		for (const d of drops) {
			ctx.globalAlpha = d.alpha;
			ctx.beginPath();
			ctx.moveTo(d.x, d.y);
			ctx.lineTo(d.x + 0.6, d.y + d.len);
			ctx.stroke();
			d.y += d.vy;
			if (d.y > h) {
				d.y = -d.len;
				d.x = Math.random() * w;
			}
		}
		ctx.restore();
	}

	function drawRipples() {
		if (!opts.rippleEnable) return;
		ctx.save();
		for (let i = ripples.length - 1; i >= 0; i--) {
			const rp = ripples[i];
			ctx.globalAlpha = rp.alpha;
			ctx.strokeStyle = "rgba(255,255,255,0.9)";
			ctx.lineWidth = 1.2;
			ctx.beginPath();
			ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
			ctx.stroke();
			rp.r += 1.6;
			rp.alpha -= 0.012;
			if (rp.alpha <= 0 || rp.r >= rp.maxR) ripples.splice(i, 1);
		}
		ctx.restore();
	}

	function tick() {
		if (!running) return;
		ctx.clearRect(0, 0, w, h);

		// 擦痕沿指针路径补点，保证快速移动时不断线
		if (pointer) {
			if (lastPointer) {
				const dx = pointer.x - lastPointer.x;
				const dy = pointer.y - lastPointer.y;
				const dist = Math.hypot(dx, dy);
				const steps = Math.min(Math.ceil(dist / 12), 12);
				for (let s = 1; s <= steps; s++) {
					erases.push({
						x: lastPointer.x + (dx * s) / steps,
						y: lastPointer.y + (dy * s) / steps,
						life: 1,
					});
				}
			} else {
				erases.push({ x: pointer.x, y: pointer.y, life: 1 });
			}
			lastPointer = { ...pointer };
		}

		// 雾恢复：life 衰减到 0 的擦痕移除
		for (let i = erases.length - 1; i >= 0; i--) {
			erases[i].life -= opts.restoreSpeed;
			if (erases[i].life <= 0) erases.splice(i, 1);
		}
		// 上限保护，防止长时间涂抹后数组无限增长拖慢绘制
		if (erases.length > 900) erases.splice(0, erases.length - 900);

		drawFog();
		drawRain();
		drawRipples();

		rafId = requestAnimationFrame(tick);
	}

	function start() {
		if (running) return;
		running = true;
		rafId = requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
	}

	function onPointerMove(ev: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		pointer = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
	}

	function onPointerLeave() {
		pointer = null;
		lastPointer = null;
	}

	function onPointerDown(ev: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		addRipple(ev.clientX - rect.left, ev.clientY - rect.top);
	}

	// 离开视口暂停，避免读文章时白耗 GPU 和电量
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) start();
				else stop();
			}
		},
		{ threshold: 0 },
	);

	const ro = new ResizeObserver(() => resize());

	resize();
	io.observe(canvas);
	ro.observe(canvas);
	canvas.addEventListener("pointermove", onPointerMove, { passive: true });
	canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
	canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) stop();
		else start();
	});

	return function destroy() {
		stop();
		io.disconnect();
		ro.disconnect();
		canvas.removeEventListener("pointermove", onPointerMove);
		canvas.removeEventListener("pointerleave", onPointerLeave);
		canvas.removeEventListener("pointerdown", onPointerDown);
	};
}
