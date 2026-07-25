import type { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";

export type SiteConfig = {
	title: string;
	subtitle: string;

	lang:
		| "en"
		| "zh_CN"
		| "zh_TW"
		| "ja"
		| "ko"
		| "es"
		| "th"
		| "vi"
		| "tr"
		| "id";

	themeColor: {
		hue: number;
		fixed: boolean;
	};
	banner: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url?: string;
		};
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	favicon: Favicon[];
};

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export type HeroConfig = {
	enable: boolean;
	/** 背景图路径，相对 /src 目录；以 '/' 开头则相对 /public */
	src: string;
	/**
	 * 是否尊重系统的「减少动画」偏好（prefers-reduced-motion: reduce）。
	 * true（默认）：命中该偏好时不启动 Canvas，只留静态背景图。
	 * false：无视系统偏好，始终播放雾/雨/涟漪。
	 */
	respectReducedMotion: boolean;
	fog: {
		/** 雾浓度（0~1）。只作用于水面线以上；越高背景越糊 */
		opacity: number;
		/** 鼠标擦雾半径（px），40~200 */
		eraseRadius: number;
		/** 雾恢复速度，0.001~0.02，越大擦痕消失越快 */
		restoreSpeed: number;
	};
	rain: {
		enable: boolean;
		/** 雨滴数量，建议 20~60；过多会盖掉单颗落水的效果 */
		count: number;
		/** 下落速度基数，0.5~4 */
		speed: number;
		/** 落水时注入水面的扰动强度，0.5~3；越大涟漪越明显 */
		dropStrength: number;
	};
	ripple: {
		enable: boolean;
		/** 同时存在的落水闪点上限，4~24 */
		maxCount: number;
		/** 鼠标拂水的扰动强度，0.1~1.2；越大水被推得越开 */
		pointerStrength: number;
		/** 鼠标扰动作用半径（模拟网格格点数），1~5 */
		pointerRadius: number;
	};
	/** 水面（height-field 双缓冲水波模拟） */
	water: {
		enable: boolean;
		/** 水面线高度占屏幕比例，0~1。0.62 表示下 38% 是水 */
		lineRatio: number;
		/** 模拟网格宽度，64~256。越大越细腻也越耗 CPU */
		simWidth: number;
		/** 透视压缩系数，1~4。越大纵向格点越少，涟漪越扁（更像俯视水面） */
		perspective: number;
		/** 水波阻尼，0.95~0.999。越接近 1 涟漪存在越久 */
		damping: number;
		/** 折射强度（像素偏移），0~6。越大水下背景扭曲越强 */
		refraction: number;
		/** 反光强度，0~40。作用于波面明暗对比 */
		gloss: number;
		/** 水色浓度，0~1。越大水越蓝越不透，0 则完全透出背景 */
		tint: number;
		/** 环境微起伏幅度，0~0.01。让水面静止时也有轻微波动 */
		ambient: number;
	};
};

export enum LinkPreset {
	Home = 0,
	Archive = 1,
	About = 2,
	Categories = 3,
	Tags = 4,
}

export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
};

export type NavBarConfig = {
	links: (NavBarLink | LinkPreset)[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof AUTO_MODE;

export type BlogPostData = {
	body: string;
	title: string;
	published: Date;
	description: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	category?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
};

export type ExpressiveCodeConfig = {
	theme: string;
};
