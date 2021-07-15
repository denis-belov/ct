import './index.scss';
import '@babel/polyfill';

import Loader from 'external-data-loader';



const loader = new Loader();

const canvas = document.getElementById('canvas');

const gl = canvas.getContext('webgl2');

const DPR = window.devicePixelRatio || 1;

canvas.width = window.innerWidth * DPR;
canvas.height = window.innerHeight * DPR;

gl.viewport(0, 0, window.innerWidth * DPR, window.innerHeight * DPR);
gl.clearColor(0, 0, 0, 1);



let scale = 1;
const offsets = [ 0, 0 ];



class Plane
{
	constructor (image_width, image_height)
	{
		this.geometry = new Float32Array([ -1, -1, 0, -1, 3, 0, 3, -1, 0 ]);

		this.program = gl.createProgram();

		this.vs_code =
			`#version 300 es

			precision highp int;
			precision highp float;

			layout (location = 0) in vec3 a_position;

			void main (void)
			{
				gl_Position = vec4(a_position, 1.0);
			}`;

		this.vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(this.vs, this.vs_code);
		gl.compileShader(this.vs);

		if (!gl.getShaderParameter(this.vs, gl.COMPILE_STATUS))
		{
			const strOut = `\n${ this.vs_code.split('\n').map((elm, i) => `${ i + 1 }:${ elm }`).join('\n') }\n`;

			throw new Error(`${ strOut }${ gl.getShaderInfoLog(this.vs) }`);
		}

		gl.attachShader(this.program, this.vs);

		this.fs_code =
			`#version 300 es

			precision highp int;
			precision highp float;

			uniform highp usampler2D U_IMAGE_DATA;
			uniform vec2 u_window_size;
			uniform vec2 u_image_size;
			uniform vec2 u_offsets;
			uniform float u_scale;
			uniform float u_window_width;
			uniform float u_window_level;

			layout (location = 0) out vec4 fragment_color;

			float convert (float x, float lowest, float highest)
			{
				float a = 255.0 / (highest - lowest);

				float b = -255.0 / (highest - lowest) * lowest;

				float y = (a * x) + b;

				return y;
			}

			void main (void)
			{
				vec2 tex_coords = gl_FragCoord.xy / u_window_size;

				vec2 offsets = u_offsets;

				if
				(
					(u_image_size.x / u_image_size.y) <
					(u_window_size.x / u_window_size.y)
				)
				{
					float new_image_width = u_window_size.y / u_image_size.y * u_image_size.x;

					tex_coords.s -= 0.5;
					tex_coords.s *= u_window_size.x / new_image_width;
					tex_coords.s += 0.5;

					offsets.s /= new_image_width;
					offsets.t /= u_window_size.y;
				}
				else
				{
					float new_image_height = u_window_size.x / u_image_size.x * u_image_size.y;

					tex_coords.t -= 0.5;
					tex_coords.t *= u_window_size.y / new_image_height;
					tex_coords.t += 0.5;

					offsets.s /= u_window_size.x;
					offsets.t /= new_image_height;
				}

				tex_coords += offsets;

				tex_coords -= 0.5;
				tex_coords *= u_scale;
				tex_coords += 0.5;

				if
				(
					tex_coords.s < 0.0 ||
					tex_coords.s > 1.0 ||
					tex_coords.t < 0.0 ||
					tex_coords.t > 1.0
				)
				{
					discard;
				}

				float lowest = u_window_level - (u_window_width / 2.0);
				float highest = u_window_level + (u_window_width / 2.0);

				float greyscale_in = float (texture(U_IMAGE_DATA, tex_coords).r);

				float greyscale_out = convert(greyscale_in, lowest, highest);

				fragment_color.rgb = vec3(greyscale_out / 255.0);

				fragment_color.a = 1.0;
			}`;

		this.fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(this.fs, this.fs_code);
		gl.compileShader(this.fs);

		if (!gl.getShaderParameter(this.fs, gl.COMPILE_STATUS))
		{
			const strOut = `\n${ this.fs_code.split('\n').map((elm, i) => `${ i + 1 }:${ elm }`).join('\n') }\n`;

			throw new Error(`${ strOut }${ gl.getShaderInfoLog(this.fs) }`);
		}

		gl.attachShader(this.program, this.fs);

		this.position_buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.position_buffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.geometry.buffer, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.linkProgram(this.program);

		gl.useProgram(this.program);

		this.u_window_size = gl.getUniformLocation(this.program, 'u_window_size');
		this.u_image_size = gl.getUniformLocation(this.program, 'u_image_size');
		this.u_offsets = gl.getUniformLocation(this.program, 'u_offsets');
		this.u_scale = gl.getUniformLocation(this.program, 'u_scale');
		this.u_window_width = gl.getUniformLocation(this.program, 'u_window_width');
		this.u_window_level = gl.getUniformLocation(this.program, 'u_window_level');

		gl.uniform1i(gl.getUniformLocation(this.program, 'U_IMAGE_DATA'), 0);
		gl.uniform2f(this.u_window_size, window.innerWidth * DPR, window.innerHeight * DPR);
		gl.uniform2f(this.u_image_size, image_width, image_height);
		gl.uniform1f(this.u_scale, scale);

		gl.enableVertexAttribArray(0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.position_buffer);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, 0, 0, 0);
	}
}



window.addEventListener
(
	'load',

	async () =>
	{
		await loader.load
		(
			{
				sources:
				{
					image_data:
					{
						source: 'assets/input_16.img',

						type: 'arraybuffer',

						middleware: (buffer) => new Uint16Array(buffer),
					},

					header:
					{
						source: 'assets/input.hdr',

						type: 'text',

						middleware: (text) => JSON.parse(text),
					},
				},

				progress: () => 0,
			},
		);

		const { image_data, header } = loader.content;

		document.getElementById('window_width').innerHTML = header.windowWidth;
		document.getElementById('window_level').innerHTML = header.windowLevel;



		const gl_texture = gl.createTexture();

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, gl_texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

		gl.texImage2D
		(
			gl.TEXTURE_2D,
			0,
			gl.R16UI,
			header.imageWidth, header.imageHeight,
			0,
			gl.RED_INTEGER,
			gl.UNSIGNED_SHORT,
			image_data,
		);



		const plane = new Plane(header.imageWidth, header.imageHeight);

		gl.uniform1f(plane.u_window_width, header.windowWidth);
		gl.uniform1f(plane.u_window_level, header.windowLevel);

		const mousemove = (evt) =>
		{
			if (document.getElementById('radio-window').checked)
			{
				header.windowWidth += evt.movementX;

				if (header.windowWidth < 0)
				{
					header.windowWidth = 0;
				}
				else if (header.windowWidth > 0xffff)
				{
					header.windowWidth = 0xffff;
				}

				header.windowLevel -= evt.movementY;

				if (header.windowLevel < 0)
				{
					header.windowLevel = 0;
				}
				else if (header.windowLevel > header.windowWidth)
				{
					header.windowLevel = header.windowWidth;
				}

				document.getElementById('window_width').innerHTML = header.windowWidth;
				document.getElementById('window_level').innerHTML = header.windowLevel;

				gl.uniform1f(plane.u_window_width, header.windowWidth);
				gl.uniform1f(plane.u_window_level, header.windowLevel);

				gl.drawArrays(gl.TRIANGLES, 0, 3);
			}
			else if (document.getElementById('radio-scale').checked)
			{
				scale -= evt.movementY * 0.01;

				if (scale < 0.01)
				{
					scale = 0.01;
				}

				gl.uniform1f(plane.u_scale, scale);

				gl.drawArrays(gl.TRIANGLES, 0, 3);
			}
			else if (document.getElementById('radio-translate').checked)
			{
				offsets[0] -= evt.movementX;
				offsets[1] += evt.movementY;

				gl.uniform2f(plane.u_offsets, ...offsets);

				gl.drawArrays(gl.TRIANGLES, 0, 3);
			}
		};

		window.addEventListener
		(
			'mousedown',

			() =>
			{
				window.addEventListener('mousemove', mousemove);
			},
		);

		window.addEventListener
		(
			'mouseup',

			() =>
			{
				window.removeEventListener('mousemove', mousemove);
			},
		);

		window.addEventListener
		(
			'resize',

			() =>
			{
				canvas.width = window.innerWidth * DPR;
				canvas.height = window.innerHeight * DPR;

				gl.viewport(0, 0, window.innerWidth * DPR, window.innerHeight * DPR);

				gl.uniform2f(plane.u_window_size, window.innerWidth * DPR, window.innerHeight * DPR);

				gl.drawArrays(gl.TRIANGLES, 0, 3);
			},
		);



		gl.drawArrays(gl.TRIANGLES, 0, 3);
	},
);
