var jStat = require('jStat');

// main class
var glr = function() {
	var functions = {}

	// precalculated thresholds
	var thresholds = {}

	var tests = {}

	this.test = function(type) {
		if (type in tests) {
			return new tests[type](arguments[1], arguments[2], arguments[3], arguments[4], arguments[5]);
		} else {
			console.log("No test of type '"+type+"'.");
		}
	}

	/** generic utility functions **/

	/*
	 * use gradient descent in 2d to find parameters x,y so that fun(x,y) == vec
	 */
	var optimize2d = function(vec, fun, init_points, epsilon, nsamples, max_samples, gradient_evaluation_width, lower_limit, upper_limit, verbose) {
		if (typeof(verbose) === 'undefined') {
			verbose = true;
		}

		// clone variables
		vec = [vec[0],vec[1]];
		init_points = [init_points[0],init_points[1]];

		var gradient, point, next_point;
		var samples = 0;
		var diff = Infinity;
		var est_point = init_points;
		if (verbose) console.log(est_point);
		while (samples < max_samples && diff > epsilon) {
			// evaluate at current point

			// TODO : need to fix if est_points are close to boundaries, closer than gradient evaluation width

			// estimate gradient
			var l_point = [est_point[0] - gradient_evaluation_width/2, est_point[1]];
			var r_point = [est_point[0] + gradient_evaluation_width/2, est_point[1]];
			var d_point = [est_point[0], est_point[1] - gradient_evaluation_width/2];
			var u_point = [est_point[0], est_point[1] + gradient_evaluation_width/2];

			var enoughSamples = false;
			var l_samples = [[],[]];
			var r_samples = [[],[]];
			var u_samples = [[],[]];
			var d_samples = [[],[]];

			// check whether p-values are within epsilon from true p-value
			// i.e. sample until we can say with some certainty whether they are or not
			// if they are, stop estimation
			var curval = [[],[]];
			var withinZero = false;
			var curpoints;
			for (var i = 0;!withinZero && samples < max_samples;i++) {
				num_samples = nsamples*Math.pow(2,i);
				var new_curval = fun(est_point, num_samples);
				curval[0] = curval[0].concat(new_curval[0]);
				curval[1] = curval[1].concat(new_curval[1]);
				
				curpoints = [mean(curval[0]), mean(curval[1])];
				if (verbose) console.log("alpha : "+curpoints[0]+" +- "+(4*std(curval[0])/Math.sqrt(curval[0].length)));
				if (verbose) console.log("beta : "+curpoints[1]+" +- "+(4*std(curval[1])/Math.sqrt(curval[1].length)));

				// if CI does not contain 0 OR CI is smaller than 2*epsilon, stop
				var ci_halfwidth_0 = (4*std(curval[0])/Math.sqrt(curval[0].length));
				var ci_halfwidth_1 = (4*std(curval[1])/Math.sqrt(curval[1].length));
				var lower0 = curpoints[0] - ci_halfwidth_0;
				var upper0 = curpoints[0] + ci_halfwidth_0;
				var lower1 = curpoints[1] - ci_halfwidth_1;
				var upper1 = curpoints[1] + ci_halfwidth_1;
				if (sign(lower0-vec[0]) === sign(upper0-vec[0]) || sign(lower1-vec[1]) === sign(upper1-vec[1])) {
					withinZero = true;
				} else if ( ci_halfwidth_0 < epsilon && ci_halfwidth_1 < epsilon ) {
					withinZero = true;
					diff = Math.sqrt( Math.pow(ci_halfwidth_0,2) + Math.pow(ci_halfwidth_1,2) );
				}
				samples += num_samples;

				if (verbose) console.log("checked current estimate, samples:"+samples)
			}
			if (diff < epsilon || samples > max_samples) {
				break;
			}

			var i = 0;
			while (!enoughSamples && samples < max_samples) {
				num_samples = nsamples*Math.pow(2,i);
				// get samples from points
				var new_l_samples = fun(l_point, num_samples);
				var new_r_samples = fun(r_point, num_samples);
				var new_u_samples = fun(u_point, num_samples);
				var new_d_samples = fun(d_point, num_samples);


				l_samples[0] = l_samples[0].concat(new_l_samples[0]);
				l_samples[1] = l_samples[1].concat(new_l_samples[1]);
				r_samples[0] = r_samples[0].concat(new_r_samples[0]);
				r_samples[1] = r_samples[1].concat(new_r_samples[1]);
				u_samples[0] = u_samples[0].concat(new_u_samples[0]);
				u_samples[1] = u_samples[1].concat(new_u_samples[1]);
				d_samples[0] = d_samples[0].concat(new_d_samples[0]);
				d_samples[1] = d_samples[1].concat(new_d_samples[1]);
				
				if (verbose) console.log("length samples : "+l_samples[0].length);

				samples += num_samples;
				if (verbose) console.log(samples);

				var l_0_mean = mean(l_samples[0]);
				var l_1_mean = mean(l_samples[1]);
				var r_0_mean = mean(r_samples[0]);
				var r_1_mean = mean(r_samples[1]);
				var u_0_mean = mean(u_samples[0]);
				var u_1_mean = mean(u_samples[1]);
				var d_0_mean = mean(d_samples[0]);
				var d_1_mean = mean(d_samples[1]);
				var b1p1_gradient_mean = (r_0_mean-l_0_mean)/gradient_evaluation_width;
				var b1p2_gradient_mean = (u_0_mean-d_0_mean)/gradient_evaluation_width;
				var b2p1_gradient_mean = (r_1_mean-l_1_mean)/gradient_evaluation_width;
				var b2p2_gradient_mean = (u_1_mean-d_1_mean)/gradient_evaluation_width;
				//console.log("gradient : "+gradient_mean+" +- "+(4*( (std(l_samples)+std(r_samples))/Math.pow(gradient_evaluation_width,2) )/Math.sqrt(nsamples)));
				
				/*console.log("b1p1 gradient : "+b1p1_gradient_mean+" +- "+(4*( (std(r_samples[0])+std(l_samples[0]))/Math.pow(gradient_evaluation_width,2) )/Math.sqrt(nsamples)));
				console.log("b1p2 gradient : "+b1p2_gradient_mean+" +- "+(4*( (std(u_samples[0])+std(d_samples[0]))/Math.pow(gradient_evaluation_width,2) )/Math.sqrt(nsamples)));
				console.log("b2p1 gradient : "+b2p1_gradient_mean+" +- "+(4*( (std(r_samples[1])+std(l_samples[1]))/Math.pow(gradient_evaluation_width,2) )/Math.sqrt(nsamples)));
				console.log("b2p2 gradient : "+b2p2_gradient_mean+" +- "+(4*( (std(u_samples[1])+std(d_samples[1]))/Math.pow(gradient_evaluation_width,2) )/Math.sqrt(nsamples)));*/

				/*var b1p1_cov = 0;
				for (var i = 0;i < r_samples[0].length;i++) {
					b1p1_cov += (r_samples[0][i]-r_0_mean)*(l_samples[0][i]-l_0_mean);
				}
				b1p1_cov /= (r_samples[0].length-1)
				console.log("b1p1_cov:"+b1p1_cov);
				console.log(Math.pow(std(r_samples[0]),2))
				console.log(Math.pow(std(l_samples[0]),2))
				console.log((gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length))
				console.log(( Math.pow(std(r_samples[0]),2)+Math.pow(std(l_samples[0]),2) )/(gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length))
				var b1p1_sd = ( Math.pow(std(r_samples[0]),2)+Math.pow(std(l_samples[0]),2) )/(gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length) - (2*b1p1_cov)/(gradient_evaluation_width*gradient_evaluation_width);
				console.log((2*b1p1_cov)/(gradient_evaluation_width*gradient_evaluation_width))*/

				var b1p1_var = ( Math.pow(std(r_samples[0]),2)+Math.pow(std(l_samples[0]),2) )/(gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length);
				var b1p2_var = ( Math.pow(std(u_samples[0]),2)+Math.pow(std(d_samples[0]),2) )/(gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length);
				var b2p1_var = ( Math.pow(std(r_samples[1]),2)+Math.pow(std(l_samples[1]),2) )/(gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length);
				var b2p2_var = ( Math.pow(std(u_samples[1]),2)+Math.pow(std(d_samples[1]),2) )/(gradient_evaluation_width*gradient_evaluation_width*r_samples[0].length);

				if (verbose) console.log("b1p1 gradient : "+b1p1_gradient_mean+" +- "+(4*Math.sqrt(b1p1_var)) );
				if (verbose) console.log("b1p2 gradient : "+b1p2_gradient_mean+" +- "+(4*Math.sqrt(b1p2_var)) );
				if (verbose) console.log("b2p1 gradient : "+b2p1_gradient_mean+" +- "+(4*Math.sqrt(b2p1_var)) );
				if (verbose) console.log("b2p2 gradient : "+b2p2_gradient_mean+" +- "+(4*Math.sqrt(b2p2_var)) );
				
				enoughSamples = true;
				if (sign(b1p1_gradient_mean+4*Math.sqrt(b1p1_var)) != sign(b1p1_gradient_mean-4*Math.sqrt(b1p1_var))) enoughSamples = false;
				if (sign(b2p2_gradient_mean+4*Math.sqrt(b2p2_var)) != sign(b2p2_gradient_mean-4*Math.sqrt(b2p2_var))) enoughSamples = false;
				//if (sign(b1p2_gradient_mean+4*Math.sqrt(b1p2_var)) != sign(b1p2_gradient_mean-4*Math.sqrt(b1p2_var))) enoughSamples = false;
				//if (sign(b2p1_gradient_mean+4*Math.sqrt(b2p1_var)) != sign(b2p1_gradient_mean-4*Math.sqrt(b2p1_var))) enoughSamples = false;
				
				if (verbose) console.log("b1p1*b2p2:"+(b1p1_gradient_mean*b2p2_gradient_mean));
				if (verbose) console.log("b1p2*b2p1:"+(b1p2_gradient_mean*b2p1_gradient_mean));
				if (verbose) console.log("b2p2*(v0-c0):"+( b2p2_gradient_mean*(vec[0]-curpoints[0]) ));
				if (verbose) console.log("b1p2*(v1-c1):"+( b1p2_gradient_mean*(vec[1]-curpoints[1]) ));

				i += 1;
				if (verbose) console.log("getting gradients, samples:"+samples)
			}

			// extrapolate where point lies with simple linear function
			var mult = 1/(b1p1_gradient_mean*b2p2_gradient_mean - b1p2_gradient_mean*b2p1_gradient_mean);
			next_point = [mult,mult];
			next_point[0] *= ( b2p2_gradient_mean*(vec[0]-curpoints[0]) - b1p2_gradient_mean*(vec[1]-curpoints[1]) );
			next_point[1] *= ( b1p1_gradient_mean*(vec[1]-curpoints[1]) - b2p1_gradient_mean*(vec[0]-curpoints[0]) );

			// calculate difference between new point and estimated point
			//diff = Math.sqrt(next_point[0]*next_point[0] + next_point[1]*next_point[1]);

			//next_point = est_point + 0.5*(next_point-est_point);
			if (verbose) console.log(next_point);
			est_point[0] += next_point[0];
			est_point[1] += next_point[1];

			if (upper_limit) {
				if (est_point[0] > upper_limit) {
					est_point[0] = upper_limit;
				}
				if (est_point[1] > upper_limit) {
					est_point[1] = upper_limit;
				}
			}
			if (lower_limit) {
				if (est_point[0] < lower_limit) {
					est_point[0] = lower_limit;
				}
				if (est_point[1] < lower_limit) {
					est_point[1] = lower_limit;
				}
			}

			if (verbose) console.log(est_point);
		}
		// calculate estimate of final value
		var curval = fun(est_point, nsamples);
		curpoints = [mean(curval[0]), mean(curval[1])];

		if (verbose) console.log("alpha : "+curpoints[0]+" +- "+(4*std(curval[0])/Math.sqrt(nsamples)));
		if (verbose) console.log("beta : "+curpoints[1]+" +- "+(4*std(curval[1])/Math.sqrt(nsamples)));

		return est_point;
	}

	var mean = function(seq) {
		var sum = 0;
		for (var i = 0;i < seq.length;i++) {
			sum += seq[i];
		}
		return sum/seq.length;
	}

	var boot_std = function(seq,n) {
		var sl = seq.length;
		var boot_means = [];
		for (var i = 0;i < n;i++) {
			var boot_seq = [];
			for (var j = 0;j < sl;j++) {
				var ind = Math.floor(Math.random()*sl);
				boot_seq.push(seq[ind]);
			}
			boot_means.push(mean(boot_seq));
		}
		return std(boot_means);
	}

	var std = function(seq) {
		var mean_seq = mean(seq);
		var sum = 0;
		for (var i = 0;i < seq.length;i++) {
			sum += (seq[i]-mean_seq)*(seq[i]-mean_seq);
		}
		sum /= seq.length;
		return Math.sqrt(sum);
	}

	var sign = function(x) {
	    if( +x === x ) {
	        return (x === 0) ? x : (x > 0) ? 1 : -1;
	    }
	    return NaN;
	}

	var roundToZero = function(x) {
		if (Math.abs(x) < 1e-10) {
			return 0;
		}
		return x;
	}

	var logOp = function(mult, logvar) {
		// by default 0*Infinite = NaN in javascript, so we make a custom operator where this will be equal to 0
		if (mult == 0) {
			return 0;
		}
		var logged = Math.log(logvar);
		if (!isFinite(logged)) {
			return logged;
		} 
		return mult*logged;
	}

	
	/*** test for bernoulli proportions ***/

	var bernoulli_test = function(sides, indifference, type1_error, type2_error) {

		var b0, b1, stoppingTime;

		var x_data = [];
		var y_data = [];
		var n = 0;
		var alpha_value = type1_error;
		var beta_value = type2_error;
		var indiff = indifference;
		var S_x = 0;
		var S_y = 0;
		var finished = false;
		var L_an;

		/** public functions **/

		this.getResults = function() {
			var L_an = LikH0(S_x, S_y, n, indiff);
			var L_bn = LikHA(S_x, S_y, n, indiff);
			return {
				'S_x' : S_x,
				'S_y' : S_y,
				'L_an' : L_an,
				'L_bn' : L_bn,
				'finished' : finished,
				'n' : n
			};
		}

		// get p-value (only when test is done)
		// this needs to be exchanged
		this.pValue = function(samples) {
			if (!finished) {
				return undefined;
			}
			if (!samples) samples = 10000;
			console.log("calculating p-value via simulation");
			var res = 0;
			for (var i = 0;i < samples;i++) {
				if (simulateH0() >= L_an) {
					res += 1;
				}
			}
			return res/samples;
		}

		// get confidence interval (only when test is done)
		this.confInterval = function(samples) {
			if (!finished) {
				return undefined;
			}
			if (!samples) samples = 10000;

			// get unbiased result
			var ests = this.estimate();

			var outcomes = [];
			// simulate n outcomes
			for (var i = 0;i < samples;i++) {
				var res = simulateResult(ests[0],ests[1],b0,b1);
				var time = res[3];
				outcomes[i] = [res[1]/time, res[2]/time];
			}
			outcomes.sort(function(a,b){return (a[0]-a[1])-(b[0]-b[1]);})

			// bias corrected bootstrap confidence interval
			var outcomes_diff = [];
			var lower_count = 0;
			for (var i = 0;i < outcomes.length;i++) {
				outcomes_diff[i] = outcomes[i][0] - outcomes[i][1];
				if (outcomes_diff[i] < ((S_x/n)-(S_y/n))) lower_count += 1;
			}
			//console.log("lower count:"+lower_count)
			var b = jStat.jStat.normal.inv(lower_count/samples,0,1);
			//console.log(b);
			var upper_n = Math.floor((samples+1)*jStat.jStat.normal.cdf(2*b + 1.96,0,1));
			var lower_n = Math.floor((samples+1)*jStat.jStat.normal.cdf(2*b - 1.96,0,1));
			//console.log("lower_n:"+lower_n)
			//console.log("upper_n:"+upper_n)
			var lower_est = outcomes[lower_n];
			var upper_est = outcomes[upper_n];

			// bias correct the lower and upper estimates
			var lower_est_bc = optimize2d(lower_est, biasFun(), lower_est, 0.005, 16400, 590000, 0.02, 0, 1, false);
			var upper_est_bc = optimize2d(upper_est, biasFun(), upper_est, 0.005, 16400, 590000, 0.02, 0, 1, false);

			return [(lower_est_bc[0]-lower_est_bc[1]),(upper_est_bc[0]-upper_est_bc[1])];
		}

		// get estimate (only when test is done)
		  // use bias-reduction
		this.estimate = function() {
			if (!finished) {
				return undefined;
			}
			var ests = optimize2d([S_x/n, S_y/n], biasFun(), [S_x/n, S_y/n], 0.005, 16400, 590000, 0.02, 0, 1, false);
			// TODO : should we include std.dev.?
			return [ests[0], ests[1], ests[0]-ests[1]];
		}
		
		// get sequence of data
		this.getData = function() {
			return [x_data, y_data];
		}
		
		// add single or paired datapoint (control or treatment)
			// returns true if test is finished
		this.addData = function(points) {
			if (finished) {
				if (typeof points[0] === 'number') x_data.push(points[0]);
				if (typeof points[1] === 'number') y_data.push(points[1]);
			} else {
				if (typeof points[0] === 'number' && typeof points[1] === 'number') {
					if (x_data.length == y_data.length) {
						S_x += points[0];
						S_y += points[1];
						n += 1;
					} else if (x_data.length > y_data.length) {
						S_y += points[1];
						S_x += x_data[n];
						n += 1;
					} else {
						S_x += points[0];
						S_y += y_data[n];
						n += 1;
					}
					x_data.push(points[0])
					y_data.push(points[1])
				} else if (typeof points[0] === 'number') {
					if (x_data.length < y_data.length) {
						S_x += points[0];
						S_y += y_data[n];
						n += 1;
					}
					x_data.push(points[0]);
				} else if (typeof points[1] === 'number') {
					if (x_data.length > y_data.length) {
						S_y += points[1];
						S_x += x_data[n];
						n += 1;
					}
					y_data.push(points[1]);
				}
			}
			
			var result = checkTest(S_x, S_y, n, indiff, b0, b1);
			if (result) {
				finished = true;
				stoppingTime = n;
				L_an = result[1];
				return result[0];
			}
		}

		// get expected samplesize for some parameters
		/*this.expectedSamplesize = function(p1, p2, samples) {
			// simulate it enough times
			if (!samples) samples = 10000;
			console.log("calculating expected samplesize via simulation");
			var times = [];
			for (var i = 0;i < samples;i++) {
				var res = simulateResult(p1,p2,b0,b1)
				times.push(res[3]);
			}
			return mean(times);
		}*/

		this.expectedSamplesize = function(p1, p2, samples) {
			// simulate it enough times
			if (!samples) samples = 10000;
			console.log("calculating expected samplesize via simulation");
			var times = [];
			for (var i = 0;i < samples;i++) {
				var res = simulateResult(p1,p2,b0,b1)
				times.push(res[3]);
			}
			times.sort(function(a,b){return a-b});
			return [times[samples*0.05], mean(times), times[samples*0.95]];
		}

		/** private functions **/
		
		var biasFun = function() {
			var outfun = function(pt, n) {
				var results_p1 = []
				var results_p2 = []
				for (var i = 0;i < n;i++) {
					// generate sequences
					var res = simulateResult(pt[0], pt[1], b0, b1);
					results_p1.push( res[1]/res[3] );
					results_p2.push( res[2]/res[3] );
				}
				return [results_p1, results_p2];
			}
			return outfun;
		}
		
		var checkTest = function(S_x, S_y, n, d, b0, b1) {
			// check if test should be stopped
			
			// TODO : should I check for when both L_an and L_bn pass thresholds?

			var L_an = LikH0(S_x, S_y, n, d);
			if (L_an >= b0) {
				return ['false',L_an];
			}
			var L_bn = LikHA(S_x, S_y, n, d);
			if (L_bn >= b1) {
				return ['true',L_an]
			}
			return undefined
		}

		var LikH0 = functions['bernoulli'][sides]['l_an'];
		this.LikH0 = LikH0;
		var LikHA = functions['bernoulli'][sides]['l_bn'];

		var boundaryFun = function(indiff) {
			// simulate alpha and beta-value
			var outfun = function(boundaries, n) {
				// calculate alpha with these boundaries
				var results_alpha = alpha(boundaries[0], boundaries[1], indiff, simulateResult, n);
				// calculate beta with these boundaries
				var results_beta = beta(boundaries[0], boundaries[1], indiff, simulateResult, n);
				return [results_alpha, results_beta];
			}
			return outfun;
		}

		var generate = function(p) {
			if (Math.random() < p) {return 1;} else {return 0;}
		}
		
		var alpha = functions['bernoulli'][sides]['alpha'];
		var beta = functions['bernoulli'][sides]['beta'];
		this.beta = beta;
		this.alpha = alpha;
		
		var simulateResult = function(p1, p2, b0, b1) {
			var finished = false;
			var time = 0;
			var S_x = 0;
			var S_y = 0;
			var result;
			while (!finished) {
				S_x += generate(p1);
				S_y += generate(p2);
				time += 1;
				// test it
				var result = checkTest(S_x, S_y, time, indiff, b0, b1);
				if (result) finished = true;
			}
			// return result, S_x, S_y, stoppingTime
			return [result[0], S_x, S_y, time, result[1]];
		}
		this.simulateResult = simulateResult;

		// initialization:
		  // calculate thresholds (unless they are stored in table)
		if (sides in thresholds['bernoulli'] && alpha_value in thresholds['bernoulli'][sides] && beta_value in thresholds['bernoulli'][sides][alpha_value] && indifference in thresholds['bernoulli'][sides][alpha_value][beta_value]) {
			b0 = thresholds['bernoulli'][sides][alpha_value][beta_value][indifference][0];
			b1 = thresholds['bernoulli'][sides][alpha_value][beta_value][indifference][1];
		} else {
			// calculate thresholds
			console.log("calculating thresholds via simulation")
			//var thr = optimize2d([alpha_value, beta_value], boundaryFun(indifference), [50,10], 0.001, 46000, 400000, 6, 1)
			//var thr = optimize2d([alpha_value, beta_value], boundaryFun(indifference), [98,14.5], 0.001, 46000, 1500000, 6, 1)
			var thr = optimize2d([alpha_value, beta_value], boundaryFun(indifference), [65,65], 0.001, 46000, 1500000, 6, 1)
			b0 = thr[0];
			b1 = thr[1];
		}

		this.maxSamplesize = functions['bernoulli'][sides]['max_samplesize'](b0,b1,indiff);
		var simulateH0 = functions['bernoulli'][sides]['simulateH0'](simulateResult, indiff, b0, b1);

		// get test variables
		this.properties = {
			'alpha' : alpha_value,
			'beta' : beta_value,
			'indifference region' : indiff,
			'sides' : sides,
			'b0' : b0,
			'b1' : b1
		}

		this.comparePower = function(p1,p2,samples) {
			var fixedPower = [];
			var seqPower = [];
			var samplesize = 52735;
			for (var i = 0;i < samples;i++) {
				// generate sample
				var res = simulateResult(p1,p2,b0,b1);
				if (res[0] == "true") {
					seqPower[i] = 1;
				} else {
					seqPower[i] = 0;
				}
				// test if reject H0
				var mle1 = 0;
				var mle2 = 0;
				for (var j = 0;j < samplesize;j++) {
					mle1 += generate(p1);
					mle2 += generate(p2);
				}
				mle1 /= samplesize;
				mle2 /= samplesize;
				var mlecomm = 0.5*mle1 + 0.5*mle2;
				var z_val = (mle1-mle2)/Math.sqrt(mlecomm*(1-mlecomm)*(1/samplesize + 1/samplesize))
				if (Math.abs(z_val) > 1.96) {
					fixedPower[i] = 0;
				} else {
					fixedPower[i] = 1;
				}
				// add
			}
			return [mean(seqPower), mean(fixedPower)];
		}

		this.compareErrors = function(p1, p2, samples) {
			var fixedErrors = 0;
			var seqErrors = 0;
			var allOver = 0;
			var samplesize = 52735;
			for (var i = 0;i < samples;i++) {
				var finished = false;
				var time = 0;
				var S_x = 0;
				var S_y = 0;
				var result;
				var S_x_fixed = 0;
				var S_y_fixed = 0;
				while (!finished) {
					S_x += generate(p1);
					S_y += generate(p2);
					time += 1;
					// test it
					var result = checkTest(S_x, S_y, time, indiff, b0, b1);
					if (result) finished = true;
					if (time == samplesize) {
						S_x_fixed = S_x;
						S_y_fixed = S_y;
					}
				}
				if (time > samplesize) {
					if (result[0] == "true") seqErrors += 1;
					allOver += 1;
					var mle1 = S_x_fixed/samplesize;
					var mle2 = S_y_fixed/samplesize;
					var mlecomm = 0.5*mle1 + 0.5*mle2;
					var z_val = (mle1-mle2)/Math.sqrt(mlecomm*(1-mlecomm)*(1/samplesize + 1/samplesize))
					if (Math.abs(z_val) <= 1.96) fixedErrors += 1;
				}
			}
			return [seqErrors/allOver, fixedErrors/allOver, allOver];
		}

		this.compareMAB = function(samples, length) {
			var glrRegrets = [];
			var thomRegrets = [];
			var classRegrets = [];
			for (var j = 0;j < length;j++) {
				glrRegrets[j] = 0;
				thomRegrets[j] = 0;
				classRegrets[j] = 0;
			}
			for (var i = 0;i < samples;i++) {
				// generate random p1 and p2
				var p1 = Math.random();
				var p2 = Math.random();
				
				// pull random center of alpha,beta
				/*var add =jStat.jStat.normal.sample(0,0.05);
				var p2 = p1 + add
				if (p2 > 1) {
					p2 = p1 - add
				}
				console.log(p2-p1)*/

				//console.log("p1:"+p1+",p2:"+p2);
				var prior1 = [1,1];
				var prior2 = [1,1];
				var S_x = 0;
				var S_y = 0;
				var time = 0;
				var finished = false;
				var choice = undefined;
				var correct_choice = p1 <= p2 ? 0 : 1;
				var glrRegret = 0;
				var thomRegret = 0;
				var classRegret = 0;
				for (var j = 0;j < length;j++) {
					var a = Math.random() < p1 ? 1 : 0;
					var b = Math.random() < p2 ? 1 : 0;
					// glr : pull alternate samples until finished (use one-sided with very very small indifference zone, alpha = ?, beta = ?)
					if (!finished) {
						if (j % 2 == 0) {
							S_x += a;
							/*if (time > 0) {
								var result = checkTest(S_x, S_y, time, indiff, b0, b1);
								if (result) {
									finished = true;
									if (result[0] == "true") choice = 0; // i.e. choose that p1 < p2
									else choice = 1; // i.e. choose that p1 > p2
								}
							}*/
							if (correct_choice == 0) {
								glrRegret += (p2-p1);
							}
							glrRegrets[j] += glrRegret;
						} else {
							S_y += b;
							time += 1;
							var result = checkTest(S_x, S_y, time, indiff, b0, b1);
							if (result) {
								finished = true;
								if (result[0] == "true") choice = 0; // i.e. choose that p1 < p2
								else choice = 1; // i.e. choose that p1 > p2
							}
							if (correct_choice == 1) {
								glrRegret += (p1-p2);
							}
							glrRegrets[j] += glrRegret;
						}
					} else {
						// do pull from choice
						if (correct_choice != choice) {
							if (correct_choice == 0) glrRegret += (p2-p1);
							if (correct_choice == 1) glrRegret += (p1-p2);
						}
						glrRegrets[j] += glrRegret;
					}
					// bayes bandit : pull from prior, choose, etc.
					var a_post_sample = jStat.jStat.beta.sample(prior1[0],prior1[1]);
					var b_post_sample = jStat.jStat.beta.sample(prior2[0],prior2[1]);
					if (a_post_sample >= b_post_sample) {
						// choose sample a
						prior1[0] += a;
						prior1[1] += (1-a);
						if (correct_choice == 0) {
							thomRegret += (p2-p1);
						}
						thomRegrets[j] += thomRegret;
					} else {
						// choose sample b
						prior2[0] += b;
						prior2[1] += (1-b);
						if (correct_choice == 1) {
							thomRegret += (p1-p2);
						}
						thomRegrets[j] += thomRegret;
					}
					if (j % 2 == 0) {
						if (correct_choice == 0) {
							classRegret += (p2-p1);
						} else {
							classRegret += (p1-p2);
						}
					}
					classRegrets[j] += classRegret;
				}
			}
			for (var i = 0;i < length;i++) {
				glrRegrets[i] /= samples;
				thomRegrets[i] /= samples;
				classRegrets[i] /= samples;
			}
			// return array of mean regret
			return [glrRegrets, thomRegrets, classRegrets];
		}

		this.compareMAB2 = function(samples, length,eps) {
			var glrRegrets = [];
			var thomRegrets = [];
			for (var j = 0;j < length;j++) {
				glrRegrets[j] = 0;
				thomRegrets[j] = 0;
			}
			for (var i = 0;i < samples;i++) {
				// generate random p1 and p2
				var p1 = Math.random();
				var p2 = Math.random();
				//console.log("p1:"+p1+",p2:"+p2);
				var prior1 = [1,1];
				var prior2 = [1,1];
				var S_x = 0;
				var S_y = 0;
				var time = 0;
				var finished = false;
				var choice = undefined;
				var correct_choice = p1 <= p2 ? 0 : 1;
				var glrRegret = 0;
				var thomRegret = 0;
				for (var j = 0;j < length;j++) {
					var a = Math.random() < p1 ? 1 : 0;
					var b = Math.random() < p2 ? 1 : 0;
					// glr : pull alternate samples until finished (use one-sided with very very small indifference zone, alpha = ?, beta = ?)
					if (!finished) {
						if (j % 2 == 0) {
							S_x += a;
							if (time > 0) {
								var L_an = LikH0(S_x, S_y, time, indiff);
								if (L_an > Math.log(time*2 + 1)/eps) {
									finished = true;
									if (S_x/(time+1) < S_y/time) choice = 0; // i.e. choose that p1 < p2
									else choice = 1; // i.e. choose that p1 > p2
								}
							}
							if (correct_choice == 0) {
								glrRegret += (p2-p1);
							}
							glrRegrets[j] += glrRegret;
						} else {
							S_y += b;
							time += 1;
							var L_an = LikH0(S_x, S_y, time, indiff);
							if (L_an > Math.log(time*2)/eps) {
								finished = true;
								if (S_x/time < S_y/time) choice = 0; // i.e. choose that p1 < p2
								else choice = 1; // i.e. choose that p1 > p2
							}
							if (correct_choice == 1) {
								glrRegret += (p1-p2);
							}
							glrRegrets[j] += glrRegret;
						}
					} else {
						// do pull from choice
						if (correct_choice != choice) {
							if (correct_choice == 0) glrRegret += (p2-p1);
							if (correct_choice == 1) glrRegret += (p1-p2);
						}
						glrRegrets[j] += glrRegret;
					}
					// bayes bandit : pull from prior, choose, etc.
					var a_post_sample = jStat.jStat.beta.sample(prior1[0],prior1[1]);
					var b_post_sample = jStat.jStat.beta.sample(prior2[0],prior2[1]);
					if (a_post_sample >= b_post_sample) {
						// choose sample a
						prior1[0] += a;
						prior1[1] += (1-a);
						if (correct_choice == 0) {
							thomRegret += (p2-p1);
						}
						thomRegrets[j] += thomRegret;
					} else {
						// choose sample b
						prior2[0] += b;
						prior2[1] += (1-b);
						if (correct_choice == 1) {
							thomRegret += (p1-p2);
						}
						thomRegrets[j] += thomRegret;
					}
				}
			}
			for (var i = 0;i < length;i++) {
				glrRegrets[i] /= samples;
				thomRegrets[i] /= samples;
			}
			// return array of mean regret
			return [glrRegrets, thomRegrets];
		}

		this.emilie = function(p1, p2, eps, samples) {
			// simulate it enough times
			if (!samples) samples = 10000;
			var times = [];
			for (var i = 0;i < samples;i++) {
				var S_x = 0;
				var S_y = 0;
				var time = 0;
				var finished = false;
				while (!finished) {
					S_x += generate(p1);
					S_y += generate(p2);
					time += 1;
					var Lna = LikH0(S_x, S_y, time);
					if (Lna > Math.log(2*time)/eps) {
						finished = true;
					}
				}
				times.push(time);
			}
			times.sort(function(a,b){return a-b});
			return [times[samples*0.05], mean(times), times[samples*0.95]];
		}
	}

	// private functions

	var solveConstrainedBinomialMLE = function(S_x, S_y, n, d) {
		var a = (3*d*n - S_x - S_y - 2*n);
		var b = (S_x - 2*d*S_x + S_y - 2*d*n + d*d*n);
		var P = -a/(6*n);
		var Q = P*P*P + (a*b - 3*2*n*(d*S_x - d*d*S_x))/(6*2*2*n*n);
		var R = b/(6*n);
		var innerSquare = Q*Q + (R - P*P)*(R - P*P)*(R - P*P);
		var complex_part = Math.sqrt(Math.abs(innerSquare));
		var result1 = Math.pow(Q*Q + complex_part*complex_part, 1/6)*Math.cos(1/3*(Math.atan2(complex_part, Q)+4*Math.PI));
		//var result2 = Math.pow(Q*Q + complex_part*complex_part, 1/6)*Math.cos(1/3*(Math.atan2(-complex_part, Q)+2*Math.PI));
		var result = 2*result1 + P;
		if (Math.abs(result) < 1e-10) {
			result = 0;
		}
		if (Math.abs(result-1) < 1e-10) {
			result = 1;
		}
		if (result > 1 || result < 0) {
			console.log("root choice error in constrained MLE!");
			console.log(result);
			console.log("S_x:"+S_x)
			console.log("S_y:"+S_y)
			console.log("n:"+n)
			console.log("d:"+d)
		}
		return result;
	}

	var bernoulli_twosided_alpha = function(b0, b1, indiff, simulateResult, samples) {
		var p1 = 0.5;
		var p2 = 0.5;
		if (!samples) samples = 10000;
		// calculate alpha error via importance sampling
		var alphas = []
		for (var i = 0;i < samples;i++) {
			var beta_alpha = 5;
			var beta_beta = 5;
			var p1_ran = jStat.jStat.beta.sample(beta_alpha,beta_beta);
			var p2_ran = jStat.jStat.beta.sample(beta_alpha,beta_beta);

			var res = simulateResult(p1_ran,p2_ran,b0,b1);
			if (res[0] == 'false') {
				var stoppingTime = res[3];
				var sum_x = res[1];
				var sum_y = res[2];
				var weight = Math.exp( logOp(sum_x, p2) + logOp(stoppingTime-sum_x, 1-p2) + jStat.jStat.betaln(beta_alpha, beta_beta) - jStat.jStat.betaln(beta_alpha+sum_x, beta_beta+stoppingTime-sum_x) + logOp(sum_y, p1) + logOp(stoppingTime-sum_y, 1-p1) + jStat.jStat.betaln(beta_alpha, beta_beta) - jStat.jStat.betaln(beta_alpha+sum_y, beta_beta+stoppingTime-sum_y) );
				alphas.push(weight);
			} else {
				alphas.push(0);
			}
		}
		return alphas;
		// TODO : should we include std.dev.?
	}

	var bernoulli_twosided_beta = function(b0, b1, indiff, simulateResult, samples) {
		if (!samples) samples = 10000;
		var betas = [];
		for (var i = 0;i < samples;i++) {
			var res = simulateResult(0,indiff,b0,b1);
			if (res[0] == 'true') {
				betas.push(1);
			} else {
				betas.push(0);
			}
		}
		return betas;
		// TODO : should we include std.dev.?
	}

	var bernoulli_twosided_LR_H0 = function(S_x, S_y, n, indiff) {
		var equal_mle = (S_x+S_y)/(2*n);
		// calculate unconstrained MLE, i.e. p1 and p2 can be unequal 
		var unc_mle_x = S_x/n;
		var unc_mle_y = S_y/n;

		var likRatio = Math.exp( (logOp(S_x,unc_mle_x) + logOp(n-S_x,1-unc_mle_x) + logOp(S_y,unc_mle_y) + logOp(n-S_y,1-unc_mle_y)) - (logOp(S_x,equal_mle) + logOp(n-S_x,1-equal_mle) + logOp(S_y,equal_mle) + logOp(n-S_y,1-equal_mle)));
		return likRatio;
	}

	var bernoulli_twosided_LR_HA = function(S_x, S_y, n, indiff) {
		var unc_mle_x = S_x/n;
		var unc_mle_y = S_y/n;

		if (Math.abs(unc_mle_x-unc_mle_y) > indiff) {
			return 1;
		}
		
		var pos = solveConstrainedBinomialMLE(S_x, S_y, n, indiff);
		var neg = solveConstrainedBinomialMLE(S_x, S_y, n, -indiff);

		var A_pos = roundToZero(pos);
		var B_pos = roundToZero(1-pos);
		var C_pos = roundToZero(pos + indiff);
		var D_pos = roundToZero(1-pos-indiff);
		var pos_llik = logOp(S_x,A_pos) + logOp(n-S_x,B_pos) + logOp(S_y,C_pos) + logOp(n-S_y,D_pos);

		var A_neg = roundToZero(neg);
		var B_neg = roundToZero(1-neg);
		var C_neg = roundToZero(neg - indiff);
		var D_neg = roundToZero(1-neg+indiff);
		var neg_llik = logOp(S_x,A_neg) + logOp(n-S_x,B_neg) + logOp(S_y,C_neg) + logOp(n-S_y,D_neg);

		if (pos_llik > neg_llik) {
			return Math.exp( logOp(S_x,unc_mle_x) + logOp(n-S_x,1-unc_mle_x) + logOp(S_y,unc_mle_y) + logOp(n-S_y,1-unc_mle_y) - pos_llik );
		} else {
			return Math.exp( logOp(S_x,unc_mle_x) + logOp(n-S_x,1-unc_mle_x) + logOp(S_y,unc_mle_y) + logOp(n-S_y,1-unc_mle_y) - neg_llik );
		}
	}

	var bernoulli_twosided_maxSamplesize = function(b0, b1, indiff) {
		var returnFunction = function() {
			// TODO : how to get threshold?
			var crossed = false;
			var L_na_thresholds = [];
			var L_nb_thresholds = [];
			var maxSample = 0;			
			for (var i = 0;!crossed;i++) {
				// start with S_y at Math.floor(0.5*n) and adjust S_y up until L_na crosses threshold (if it happens)
				var S_x = Math.floor(0.5*i);
				var S_y = Math.floor(0.5*i);
				var j = 0;
				while (S_y <= i && S_x >= 0) {
					if (twosided_LR_H0(S_x, S_y, i) >= b0) {
						L_na_thresholds[i] = Math.abs(S_x/i - S_y/i);
						break;
					}
					if (j % 2 == 0) S_y += 1;
					else S_x -= 1;
					j += 1;
				}
				// start with S_y at n and adjust S_Y down towards Math.floor(0.5*n) until L_nb crosses threshold (if it happens)
				var S_x = 0;
				var S_y = i;
				var j = 0;
				while (S_y >= Math.floor(0.5*i) && S_x <= Math.floor(0.5*i)) {
					if (twosided_LR_HA(S_x, S_y, i, indiff) >= b1) {
						L_nb_thresholds[i] = Math.abs(S_x/i - S_y/i);
						break;
					}
					if (j % 2 == 0) S_y -= 1;
					else S_x += 1;
					j += 1;
				}
				// if these crosses then we've reached worst case samplesize, so stop
				if (L_na_thresholds[i] <= L_nb_thresholds[i]) {
					maxSample = i;
					crossed = true;
				}
			}
			// write to file
			/*var fs = require('fs');
			var str1 = "c(";
			var str2 = "c(";
			for (var i = 0;i < maxSample;i++) {
				if (typeof L_na_thresholds[i] == 'undefined') {
					str1 += "NA,"
				} else {
					str1 += L_na_thresholds[i].toFixed(3)+","
				}
				if (typeof L_nb_thresholds[i] == 'undefined') {
					str2 += "NA,"
				} else {
					str2 += L_nb_thresholds[i].toFixed(3)+","
				}
			}
			fs.writeFile("./test.txt",str1+"),\n"+str2+")\n", function(err){});
			*/

			return [maxSample, L_na_thresholds, L_nb_thresholds];
		}
		return returnFunction;
	}

	var bernoulli_twosided_simulateH0 = function(simRes, indiff, b0, b1) {
		var returnFun = function() {
			var res = simRes(0.5,0.5,b0,b1)[4];
			return res;
		}
		return returnFun;
	}

	var bernoulli_onesided_LR_H0 = function(S_x, S_y, n, indiff) {
		// nb! H0 is that p1 <= p2
		var unc_mle_x = S_x/n;
		var unc_mle_y = S_y/n;

		if (unc_mle_x-unc_mle_y <= -indiff/2) {
			return 1;
		}
		
		var pos = solveConstrainedBinomialMLE(S_x, S_y, n, indiff/2);

		var A_pos = roundToZero(pos);
		var B_pos = roundToZero(1-pos);
		var C_pos = roundToZero(pos + indiff/2);
		var D_pos = roundToZero(1-pos-indiff/2);
		var pos_llik = logOp(S_x,A_pos) + logOp(n-S_x,B_pos) + logOp(S_y,C_pos) + logOp(n-S_y,D_pos);

		return Math.exp( logOp(S_x,unc_mle_x) + logOp(n-S_x,1-unc_mle_x) + logOp(S_y,unc_mle_y) + logOp(n-S_y,1-unc_mle_y) - pos_llik );
	}

	var bernoulli_onesided_LR_HA = function(S_x, S_y, n, indiff) {
		// nb! HA is that p1 >= p2

		var unc_mle_x = S_x/n;
		var unc_mle_y = S_y/n;

		if (unc_mle_x-unc_mle_y >= indiff/2) {
			return 1;
		}
		
		var neg = solveConstrainedBinomialMLE(S_x, S_y, n, -indiff/2);

		var A_neg = roundToZero(neg);
		var B_neg = roundToZero(1-neg);
		var C_neg = roundToZero(neg - indiff/2);
		var D_neg = roundToZero(1-neg+indiff/2);
		var neg_llik = logOp(S_x,A_neg) + logOp(n-S_x,B_neg) + logOp(S_y,C_neg) + logOp(n-S_y,D_neg);

		return Math.exp( logOp(S_x,unc_mle_x) + logOp(n-S_x,1-unc_mle_x) + logOp(S_y,unc_mle_y) + logOp(n-S_y,1-unc_mle_y) - neg_llik );
	}

	var bernoulli_onesided_alpha = function(b0, b1, indiff, simulateResult, samples) {
		if (!samples) samples = 10000;
		var alphas = [];
		for (var i = 0;i < samples;i++) {
			var res = simulateResult(0.5-(indiff/2),0.5+(indiff/2),b0,b1);
			//var res = simulateResult(0,indiff/2,b0,b1);
			if (res[0] == 'false') {
				alphas.push(1);
			} else {
				alphas.push(0);
			}
		}
		return alphas;
		// TODO : should we include std.dev.?
	}

	var bernoulli_onesided_beta = function(b0, b1, indiff, simulateResult, samples) {
		if (!samples) samples = 10000;
		var betas = [];
		for (var i = 0;i < samples;i++) {
			var res = simulateResult(0.5+(indiff/2),0.5-(indiff/2),b0,b1);
			//var res = simulateResult(1,1-indiff,b0,b1);
			if (res[0] == 'true') {
				betas.push(1);
			} else {
				betas.push(0);
			}
		}
		return betas;
		// TODO : should we include std.dev.?
	}

	var bernoulli_onesided_maxSamplesize = function(b0, b1, indiff) {
		var returnFunction = function() {
			var crossed = false;
			var L_na_thresholds = [];
			var L_nb_thresholds = [];
			var maxSample = 0;			
			for (var i = 0;!crossed;i++) {
				// start with S_y at Math.floor(0.5*n) and adjust S_y up until L_na crosses threshold (if it happens)
				var S_x = Math.floor(0.5*i);
				var S_y = Math.floor(0.5*i);
				var j = 0;
				while (S_y >= 0 && S_x <= i) {
					if (onesided_LR_H0(S_x, S_y, i, indiff) >= b0) {
						L_na_thresholds[i] = S_x/i - S_y/i;
						break;
					}
					if (j % 2 == 0) S_y -= 1;
					else S_x += 1;
					j += 1;
				}
				// start with S_y at Math.floor(0.5*n) and adjust S_Y down until L_nb crosses threshold (if it happens)
				var S_x = Math.floor(0.5*i);
				var S_y = Math.floor(0.5*i);
				var j = 0;
				while (S_y <= i && S_x >= 0) {
					if (onesided_LR_HA(S_x, S_y, i, indiff) >= b1) {
						L_nb_thresholds[i] = S_x/i - S_y/i;
						break;
					}
					if (j % 2 == 0) S_y += 1;
					else S_x -= 1;
					j += 1;
				}
				// if these crosses then we've reached worst case samplesize, so stop
				if (L_na_thresholds[i] <= L_nb_thresholds[i]) {
					maxSample = i;
					crossed = true;
				}
			}
			// write to file
			var fs = require('fs');
			var str1 = "c(";
			var str2 = "c(";
			for (var i = 0;i < maxSample;i++) {
				if (typeof L_na_thresholds[i] == 'undefined') {
					str1 += "NA,"
				} else {
					str1 += L_na_thresholds[i].toFixed(3)+","
				}
				if (typeof L_nb_thresholds[i] == 'undefined') {
					str2 += "NA,"
				} else {
					str2 += L_nb_thresholds[i].toFixed(3)+","
				}
			}
			fs.writeFile("./test.txt",str1+"),\n"+str2+")\n", function(err){});

			return [maxSample, L_na_thresholds, L_nb_thresholds];
		}
		return returnFunction;
	}

	var bernoulli_onesided_simulateH0 = function(simRes, indiff, b0, b1) {
		var returnFun = function() {
			var res = simRes(0.5-indiff/2,0.5+indiff/2,b0,b1)[4];
			return res;
		}
		return returnFun;
	}

	functions['bernoulli'] = {
		'one-sided' : {
			'l_an' : bernoulli_onesided_LR_H0,
			'l_bn' : bernoulli_onesided_LR_HA,
			'alpha' : bernoulli_onesided_alpha,
			'beta' : bernoulli_onesided_beta,
			'max_samplesize' : bernoulli_onesided_maxSamplesize,
			'simulateH0' : bernoulli_onesided_simulateH0,
		},
		'two-sided' : {
			'l_an' : bernoulli_twosided_LR_H0,
			'l_bn' : bernoulli_twosided_LR_HA,
			'alpha' : bernoulli_twosided_alpha,
			'beta' : bernoulli_twosided_beta,
			'max_samplesize' : bernoulli_twosided_maxSamplesize,
			'simulateH0' : bernoulli_twosided_simulateH0,
		}
	}
	  
	thresholds['bernoulli'] = {
		'two-sided' : {
			0.05 : {
				0.10 : {
					0.4 : [68.6, 12.9],
					0.2 : [98, 14.6],
					0.1 : [139, 14.5],
					0.05 : [172, 15.5],
					0.025 : [220, 15.5],
					0.01 : [255, 15.7],
				}
			}
		},
		'one-sided' : {
			0.05 : {
				0.05 : {
					0.2 : [10.9, 10.9],
					0.1 : [19.7, 19.7],
					0.05 : [26, 26],
					0.025 : [44.5, 44.5],
					0.01 : [67,67]
				}
			}
		}
	}

	tests['bernoulli'] = bernoulli_test;
	
	/*** test for bernoulli proportions, best-arm selection with δ-PAC guarantees ***/

	var bernoulli_pac = function(delta_value) {

		var delta = delta_value; // the error guarantee we want
		var x_data = [];
		var y_data = [];
		var n_x = 0;
		var n_y = 0;
		var S_x = 0;
		var S_y = 0;
		var finished = false;
		var L_an;

		/** public functions **/

		this.getResults = function() {
			var L_an = LikH0(S_x, S_y, n_x, n_y);
			return {
				'S_x' : S_x,
				'S_y' : S_y,
				'L_an' : L_an,
				'finished' : finished,
				'n_x' : n_x,
				'n_y' : n_y
			};
		}

		// get confidence interval (only when test is done)
		this.confInterval = function(samples) {
			if (!finished) {
				return undefined;
			}
			if (!samples) samples = 10000;

			// get unbiased result
			var ests = this.estimate();

			var outcomes = [];
			// simulate n outcomes
			for (var i = 0;i < samples;i++) {
				var res = simulateResult(ests[0],ests[1]);
				var time = res[3];
				outcomes[i] = [res[1]/time, res[2]/time];
			}
			outcomes.sort(function(a,b){return (a[0]-a[1])-(b[0]-b[1]);})

			// bias corrected bootstrap confidence interval
			var outcomes_diff = [];
			var lower_count = 0;
			for (var i = 0;i < outcomes.length;i++) {
				outcomes_diff[i] = outcomes[i][0] - outcomes[i][1];
				if (outcomes_diff[i] < ((S_x/n_x)-(S_y/n_y))) lower_count += 1;
			}
			//console.log("lower count:"+lower_count)
			var b = jStat.jStat.normal.inv(lower_count/samples,0,1);
			//console.log(b);
			var upper_n = Math.floor((samples+1)*jStat.jStat.normal.cdf(2*b + 1.96,0,1));
			var lower_n = Math.floor((samples+1)*jStat.jStat.normal.cdf(2*b - 1.96,0,1));
			//console.log("lower_n:"+lower_n)
			//console.log("upper_n:"+upper_n)
			var lower_est = outcomes[lower_n];
			var upper_est = outcomes[upper_n];

			// bias correct the lower and upper estimates
			var lower_est_bc = optimize2d(lower_est, biasFun(), lower_est, 0.005, 16400, 590000, 0.02, 0, 1, false);
			var upper_est_bc = optimize2d(upper_est, biasFun(), upper_est, 0.005, 16400, 590000, 0.02, 0, 1, false);

			return [(lower_est_bc[0]-lower_est_bc[1]),(upper_est_bc[0]-upper_est_bc[1])];
		}

		// get estimate (only when test is done)
		  // use bias-reduction
		this.estimate = function() {
			if (!finished) {
				return undefined;
			}
			var ests = optimize2d([S_x/n_x, S_y/n_y], biasFun(), [S_x/n_x, S_y/n_y], 0.005, 16400, 590000, 0.02, 0, 1, false);
			// TODO : should we include std.dev.?
			return [ests[0], ests[1], ests[0]-ests[1]];
		}
		
		// get sequence of data
		this.getData = function() {
			return [x_data, y_data];
		}
		
		// add single or paired datapoint (control or treatment)
		this.addData = function(points) {
			var test = false;
			if (finished) {
				if (typeof points[0] === 'number') x_data.push(points[0]);
				if (typeof points[1] === 'number') y_data.push(points[1]);
			} else {
				if (typeof points[0] === 'number' && typeof points[1] === 'number') {
					if (x_data.length == y_data.length) {
						S_x += points[0];
						S_y += points[1];
					} else if (x_data.length > y_data.length) {
						S_y += points[1];
						if (x_data.length == y_data.length+1) {
							S_x += points[0];
						} else {
							S_x += x_data[n_x];
						}
					} else {
						S_x += points[0];
						if (x_data.length+1 == y_data.length) {
							S_y += points[1];
						} else {
							S_y += y_data[n_y];
						}
					}
					n_x += 1;
					n_y += 1;
					test = true;
					x_data.push(points[0])
					y_data.push(points[1])
				} else if (typeof points[0] === 'number') {
					if (x_data.length == y_data.length) {
						S_x += points[0];
						test = true;
						n_x += 1;
					} else if (x_data.length < y_data.length) {
						S_x += points[0];
						test = true;
						n_x += 1;
						if (x_data.length+1 != y_data.length) {
							S_y += y_data[n_y];
							n_y += 1;
						}
					}
					x_data.push(points[0]);
				} else if (typeof points[1] === 'number') {
					if (x_data.length == y_data.length) {
						S_y += points[1];
						test = true;
						n_y += 1;
					} else if (x_data.length > y_data.length) {
						S_y += points[1];
						test = true;
						n_y += 1;
						if (x_data.length != y_data.length+1) {
							S_x += x_data[n_x];
							n_x += 1;
						}
					} 
					y_data.push(points[1]);
				}
			}
			
			if (test) {
				var result = checkTest(S_x, S_y, n_x, n_y);
				if (result) {
					finished = true;
					return result;
				}
			}
		}

		// get expected samplesize for some parameters
		/*this.expectedSamplesize = function(p1, p2, samples) {
			// simulate it enough times
			if (!samples) samples = 10000;
			console.log("calculating expected samplesize via simulation");
			var times = [];
			for (var i = 0;i < samples;i++) {
				var res = simulateResult(p1,p2)
				times.push(res[3]);
			}
			return mean(times);
		}*/

		this.expectedSamplesize = function(p1, p2, samples) {
			// simulate it enough times
			if (!samples) samples = 10000;
			console.log("calculating expected samplesize via simulation");
			var times = [];
			for (var i = 0;i < samples;i++) {
				var res = simulateResult(p1,p2)
				times.push(res[3]);
			}
			times.sort(function(a,b){return a-b});
			return [times[samples*0.05], mean(times), times[samples*0.95]];
		}

		/** private functions **/
		
		var biasFun = function() {
			var outfun = function(pt, n) {
				var results_p1 = []
				var results_p2 = []
				for (var i = 0;i < n;i++) {
					// generate sequences
					var res = simulateResult(pt[0], pt[1]);
					results_p1.push( res[1]/res[3] );
					results_p2.push( res[2]/res[3] );
				}
				return [results_p1, results_p2];
			}
			return outfun;
		}
		
		var checkTest = function(S_x, S_y, n_x, n_y) {
			// check if test should be stopped
			var L_an = LikH0(S_x, S_y, n_x, n_y);
			//var mult = (n_x + n_y)*Math.log(3*(n_x + n_y))*Math.log(3*(n_x + n_y))/delta
			//if (L_an >= mult*mult) {
			//if (L_an >= Math.log(n_x + n_y)/delta) {
			if (L_an >= (Math.log(n_x + n_y)+1)/delta) {
				if (S_x/n_x > S_y/n_y) {
					return 'X';
				} else {
					return 'Y';
				}
			}
			return undefined
		}

		var LikH0 = functions['bernoulli_pac']['l_an'];

		var generate = function(p) {
			if (Math.random() < p) {return 1;} else {return 0;}
		}
		
		var simulateResult = function(p1, p2) {
			var finished = false;
			var time = 0;
			var S_x = 0;
			var S_y = 0;
			var result;
			while (!finished) {
				S_x += generate(p1);
				S_y += generate(p2);
				time += 1;
				// test it
				var result = checkTest(S_x, S_y, time, time);
				if (result) finished = true;
			}
			return [result, S_x, S_y, time];
		}

		var simulateResult2 = function(p1, p2) {
			var finished = false;
			var time = 0;
			var S_x = 0;
			var S_y = 0;
			var t_x = 0;
			var t_y = 0;
			var result;
			var i = 0
			while (!finished) {
				if (i % 2 == 0) {
					S_x += generate(p1);
					t_x += 1;
				} else {
					S_y += generate(p2);
					t_y += 1;
				}
				i += 1;
				// test it
				if (i >= 2) {
					var result = checkTest(S_x, S_y, t_x, t_y);
					if (result) finished = true;
				}
			}
			return [result, S_x, S_y, t_x, t_y];
		}

		// get test variables
		this.properties = {
			'delta' : delta,
		}

		this.expectedErrors = function(p1, p2, samples) {
			// simulate it enough times
			if (!samples) samples = 10000;
			console.log("calculating expected errors via simulation");
			if (p1 < p2) {
				var truth = "Y";
			} else {
				var truth = "X";
			}
			var errors = 0;
			var times = [];
			for (var i = 0;i < samples;i++) {
				var res = simulateResult2(p1,p2);
				if (res[0] != truth) {
					errors += 1;
				}
			}
			return errors/samples;
		}
	}

	// private functions

	var bernoulli_pac_LR_H0 = function(S_x, S_y, n_x, n_y) {
		var equal_mle = (S_x+S_y)/(n_x + n_y);
		// calculate unconstrained MLE, i.e. p1 and p2 can be unequal 
		var unc_mle_x = S_x/n_x;
		var unc_mle_y = S_y/n_y;

		var likRatio = Math.exp( (logOp(S_x,unc_mle_x) + logOp(n_x-S_x,1-unc_mle_x) + logOp(S_y,unc_mle_y) + logOp(n_y-S_y,1-unc_mle_y)) - (logOp(S_x,equal_mle) + logOp(n_x-S_x,1-equal_mle) + logOp(S_y,equal_mle) + logOp(n_y-S_y,1-equal_mle)));
		return likRatio;
	}

	functions['bernoulli_pac'] = {
		'l_an' : bernoulli_pac_LR_H0, // this is in bernoulli.js
	}
	
	tests['bernoulli_pac'] = bernoulli_pac;
	// debugging functions:
	  // test coverage of confidence intervals
}

if (typeof exports === 'object') {
	module.exports = new glr();
}
