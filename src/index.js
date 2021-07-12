import './index.scss';
import '@babel/polyfill';

import Loader from 'external-data-loader';



const DPR = window.devicePixelRatio || 1;



const loader = new Loader();



const canvas = document.getElementById('canvas');

const gl = canvas.getContext('webgl2');

gl.clearColor(0, 0, 0, 1);



let scale = 1;
const translation = [ 0, 0 ];



class Plane
{
	constructor (image_width, image_height)
	{
		this.geometry = new Float32Array([ -1, -1, 0, -1, 1, 0, 1, 1, 0, 1, 1, 0, 1, -1, 0, -1, -1, 0 ]);

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

			uniform highp usampler2D u_IMAGE_DATA;
			uniform vec2 u_image_size;
			uniform int u_window_width;
			uniform int u_window_level;

			layout (location = 0) out vec4 fragment_color;

			void main (void)
			{
				int r = int (texture(u_IMAGE_DATA, gl_FragCoord.xy / u_image_size).r);

				int lowest = u_window_level - (u_window_width / 2);
				int highest = u_window_level + (u_window_width / 2);

				if (r < lowest)
				{
					r = 0;
				}

				if (r > highest)
				{
					r = 0xffff;
				}

				fragment_color.rgb = vec3(float(r) / float(0xffff));

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
		gl.uniform1i(gl.getUniformLocation(this.program, 'u_IMAGE_DATA'), 0);
		gl.uniform2f(gl.getUniformLocation(this.program, 'u_image_size'), image_width, image_height);

		gl.useProgram(null);

		gl.enableVertexAttribArray(0);
	}

	draw ()
	{
		gl.useProgram(this.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.position_buffer);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, 0, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
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
						source: '/assets/input_16.img',

						type: 'arraybuffer',

						middleware: (buffer) => new Uint16Array(buffer),
					},

					header:
					{
						source: '/assets/input.hdr',

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

		if
		(
			(header.imageWidth / header.imageHeight) >
			(window.innerWidth / window.innerHeight)
		)
		{
			translation[1] = window.innerHeight * 0.5;

			canvas.style.width = '100%';
			canvas.style.height = 'auto';
			canvas.style.marginLeft = 0;
			canvas.style.marginTop = `-${ header.imageHeight / header.imageWidth * window.innerWidth * 0.5 }px`;
		}
		else
		{
			translation[0] = window.innerWidth * 0.5;

			canvas.style.width = 'auto';
			canvas.style.height = '100%';
			canvas.style.marginLeft = `-${ header.imageWidth / header.imageHeight * window.innerHeight * 0.5 }px`;
			canvas.style.marginTop = 0;
		}

		canvas.width = header.imageWidth * DPR;
		canvas.height = header.imageHeight * DPR;
		canvas.style.transform = `translate(${ translation[0] }px, ${ translation[1] }px) scale(${ scale })`;



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



		const plane = new Plane(header.imageWidth * DPR, header.imageHeight * DPR);

		gl.useProgram(plane.program);

		gl.uniform1i(gl.getUniformLocation(plane.program, 'u_window_width'), header.windowWidth);
		gl.uniform1i(gl.getUniformLocation(plane.program, 'u_window_level'), header.windowLevel);

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

				gl.uniform1i(gl.getUniformLocation(plane.program, 'u_window_width'), header.windowWidth);
				gl.uniform1i(gl.getUniformLocation(plane.program, 'u_window_level'), header.windowLevel);
			}
			else if (document.getElementById('radio-scale').checked)
			{
				scale -= evt.movementY * 0.01;

				if (scale < 0.01)
				{
					scale = 0.01;
				}

				canvas.style.transform = `translate(${ translation[0] }px, ${ translation[1] }px) scale(${ scale })`;
			}
			else if (document.getElementById('radio-translate').checked)
			{
				translation[0] += evt.movementX;
				translation[1] += evt.movementY;

				canvas.style.transform = `translate(${ translation[0] }px, ${ translation[1] }px) scale(${ scale })`;
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



		const render = () =>
		{
			gl.viewport(0, 0, header.imageWidth * DPR, header.imageHeight * DPR);

			gl.clear(gl.COLOR_BUFFER_BIT);

			plane.draw();

			requestAnimationFrame(render);
		};

		render();
	},
);
