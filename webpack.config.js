const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');



module.exports = (env) =>
	({
		resolve:
		{
			extensions: [ '.js', '.scss' ],
		},

		output:
		{
			path: path.join(__dirname, 'build'),
		},

		module:
		{
			rules:
			[
				{
					test: /\.js$/,
					exclude: /node_modules/,

					use:

						env === 'development' ?

							'babel-loader' :

							[
								'babel-loader',
								'eslint-loader',
							],
				},

				{
					test: /\.scss$/,

					use:
					[
						MiniCssExtractPlugin.loader,
						'css-loader',
						'sass-loader',
					],
				},

				{
					test: /\.pug$/,

					use:
					[
						'html-loader',
						'pug-html-loader',
					],
				},

				{
					test: /\.html$/,
					use: { loader: 'html-loader', options: { minimize: true } },
				},
			],
		},

		devtool: env === 'development' ? 'source-map' : false,

		plugins:
		[
			new CleanWebpackPlugin(),

			new MiniCssExtractPlugin({ filename: 'index.css' }),

			new OptimizeCSSAssetsPlugin({}),

			new HtmlWebpackPlugin
			(
				{
					filename: path.join(__dirname, 'build/index.html'),
					template: path.join(__dirname, 'src/index.pug'),
					inject: 'body',
					minify: { removeAttributeQuotes: true },
				},
			),

			new CopyPlugin
			(
				{
					patterns:
					[
						{ from: 'src/assets', to: 'assets' },
					],
				},
			),

			new webpack.DefinePlugin
			(
				{
					LOG: 'console.log',
				},
			),
		],

		devServer:
		{
			host: '0.0.0.0',
			port: 8080,
			compress: true,
			open: true,
			// https: true,
		},
	});
