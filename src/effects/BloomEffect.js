import {
	LinearFilter,
	RGBFormat,
	Uniform,
	Vector2,
	WebGLRenderTarget
} from "three";

import { KernelSize, LuminanceMaterial } from "../materials";
import { BlurPass, ShaderPass } from "../passes";
import { BlendFunction } from "./blending/BlendFunction.js";
import { Effect } from "./Effect.js";

import fragmentShader from "./glsl/texture/shader.frag";

/**
 * A bloom effect.
 *
 * This effect uses the fast Kawase convolution technique and a luminance filter
 * to blur bright highlights.
 */

export class BloomEffect extends Effect {

	/**
	 * Constructs a new bloom effect.
	 *
	 * @param {Object} [options] - The options.
	 * @param {BlendFunction} [options.blendFunction=BlendFunction.SCREEN] - The blend function of this effect.
	 * @param {Number} [options.luminanceThreshold=0.9] - The luminance threshold. Raise this value to mask out darker elements in the scene. Range is [0, 1].
	 * @param {Number} [options.luminanceSmoothing=0.025] - Controls the smoothness of the luminance threshold. Range is [0, 1].
	 * @param {Number} [options.resolutionScale=0.5] - The bloom texture resolution scale, relative to the main frame buffer size.
	 * @param {KernelSize} [options.kernelSize=KernelSize.LARGE] - The blur kernel size.
	 */

	constructor({
		blendFunction = BlendFunction.SCREEN,
		luminanceThreshold = 0.9,
		luminanceSmoothing = 0.025,
		resolutionScale = 0.5,
		kernelSize = KernelSize.LARGE
	} = {}) {

		super("BloomEffect", fragmentShader, {

			blendFunction,

			uniforms: new Map([
				["texture", new Uniform(null)]
			])

		});

		/**
		 * A render target.
		 *
		 * @type {WebGLRenderTarget}
		 * @private
		 */

		this.renderTarget = new WebGLRenderTarget(1, 1, {
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			stencilBuffer: false,
			depthBuffer: false
		});

		this.renderTarget.texture.name = "Bloom.Target";
		this.renderTarget.texture.generateMipmaps = false;

		this.uniforms.get("texture").value = this.renderTarget.texture;

		/**
		 * A blur pass.
		 *
		 * @type {BlurPass}
		 * @private
		 */

		this.blurPass = new BlurPass({ resolutionScale, kernelSize });

		/**
		 * The original resolution.
		 *
		 * @type {Vector2}
		 * @private
		 */

		this.resolution = new Vector2();

		/**
		 * A luminance shader pass.
		 *
		 * @type {ShaderPass}
		 * @private
		 */

		this.luminancePass = new ShaderPass(new LuminanceMaterial(true));

		this.luminanceMaterial.threshold = luminanceThreshold;
		this.luminanceMaterial.smoothing = luminanceSmoothing;

	}

	/**
	 * A texture that contains the intermediate result of this effect.
	 *
	 * This texture will be applied to the scene colors unless the blend function
	 * is set to `SKIP`.
	 *
	 * @type {Texture}
	 */

	get texture() {

		return this.renderTarget.texture;

	}

	/**
	 * Indicates whether dithering is enabled.
	 *
	 * @type {Boolean}
	 */

	get dithering() {

		return this.blurPass.dithering;

	}

	/**
	 * Enables or disables dithering.
	 *
	 * @type {Boolean}
	 */

	set dithering(value) {

		this.blurPass.dithering = value;

	}

	/**
	 * The blur kernel size.
	 *
	 * @type {KernelSize}
	 */

	get kernelSize() {

		return this.blurPass.kernelSize;

	}

	/**
	 * @type {KernelSize}
	 */

	set kernelSize(value) {

		this.blurPass.kernelSize = value;

	}

	/**
	 * The luminance threshold.
	 *
	 * @type {Number}
	 */

	get luminanceThreshold() {

		return this.luminancePass.getFullscreenMaterial().uniforms.threshold.value;

	}

	/**
	 * @type {Number}
	 */

	set luminanceThreshold(value) {

		const material = this.luminancePass.getFullscreenMaterial();
		material.uniforms.threshold.value = Math.min(Math.max(value, 0.0), 1.0);

	}

	/**
	 * The smoothness of the luminance threshold.
	 *
	 * @type {Number}
	 */

	get luminanceSmoothing() {

		return this.luminancePass.getFullscreenMaterial().uniforms.smoothWidth.value;

	}

	/**
	 * @type {Number}
	 */

	set luminanceSmoothing(value) {

		const material = this.luminancePass.getFullscreenMaterial();
		material.uniforms.smoothWidth.value = Math.min(Math.max(value, 0.0), 1.0);

	}

	/**
	 * @type {Number}
	 * @deprecated Use luminanceThreshold instead.
	 */

	get distinction() {

		console.warn(this.name, "The distinction field is deprecated, use luminanceThreshold and luminanceSmoothing instead.");

		return 1.0;

	}

	/**
	 * @type {Number}
	 * @deprecated Use luminanceThreshold instead.
	 */

	set distinction(value) {

		console.warn(this.name, "The distinction field is deprecated, use luminanceThreshold and luminanceSmoothing instead.");

	}

	/**
	 * Returns the current resolution scale.
	 *
	 * @return {Number} The resolution scale.
	 */

	getResolutionScale() {

		return this.blurPass.getResolutionScale();

	}

	/**
	 * Sets the resolution scale.
	 *
	 * @param {Number} scale - The new resolution scale.
	 */

	setResolutionScale(scale) {

		this.blurPass.setResolutionScale(scale);
		this.setSize(this.resolution.x, this.resolution.y);

	}

	/**
	 * Updates this effect.
	 *
	 * @param {WebGLRenderer} renderer - The renderer.
	 * @param {WebGLRenderTarget} inputBuffer - A frame buffer that contains the result of the previous pass.
	 * @param {Number} [deltaTime] - The time between the last frame and the current one in seconds.
	 */

	update(renderer, inputBuffer, deltaTime) {

		const renderTarget = this.renderTarget;

		this.luminancePass.render(renderer, inputBuffer, renderTarget);
		this.blurPass.render(renderer, renderTarget, renderTarget);

	}

	/**
	 * Updates the size of internal render targets.
	 *
	 * @param {Number} width - The width.
	 * @param {Number} height - The height.
	 */

	setSize(width, height) {

		this.resolution.set(width, height);
		this.blurPass.setSize(width, height);

		width = this.blurPass.width;
		height = this.blurPass.height;

		this.renderTarget.setSize(width, height);

	}

	/**
	 * Performs initialization tasks.
	 *
	 * @param {WebGLRenderer} renderer - The renderer.
	 * @param {Boolean} alpha - Whether the renderer uses the alpha channel or not.
	 */

	initialize(renderer, alpha) {

		this.blurPass.initialize(renderer, alpha);

		if(!alpha) {

			this.renderTarget.texture.format = RGBFormat;

		}

	}

}
