function per_pixel_concentration(img_canny, img_dxdy, params){
	var max_concentration = params.max_concentration, 
		direction = params.direction,
		width = img_canny.cols,
		height = img_canny.rows;

	function nzmin(a, b){
		if(a === 0) return b;
		if(a < b) return a;
		return b;
	}

	var saved_i = [];
	var concentration = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)

	for(var i = 0; i < width * height; i++){
		if(img_canny.data[i] != 0xff) continue; 

		var itheta = Math.atan2(img_dxdy.data[(i<<1) + 1], img_dxdy.data[i<<1]); 
		var ray = [i];
		var step = 1;
		
		var ix = i % width, iy = Math.floor(i / width);
		while(step < max_concentration){

			var jx = Math.round(ix + Math.cos(itheta) * direction * step);
			var jy = Math.round(iy + Math.sin(itheta) * direction * step);
			step++;
			if(jx < 0 || jy < 0 || jx > width || jy > height) break;
			var j = jy * width + jx;
			ray.push(j)
			if(img_canny.data[j] != 0xff) continue;
			
			var jtheta = Math.atan2(img_dxdy.data[(j<<1) + 1], img_dxdy.data[j<<1]); 
			
			if(Math.abs(Math.abs(itheta - jtheta) - Math.PI) < Math.PI / 2){ 
				saved_i.push(i)
				var sw = Math.sqrt((jx - ix) * (jx - ix) + (jy - iy) * (jy - iy)) 
				for(var k = 0; k < ray.length; k++){ 
					concentration.data[ray[k]] = nzmin(concentration.data[ray[k]], sw) 
				}
			}
			break;
		}
	}
	
	for(var k = 0; k < saved_i.length; k++){
		var i = saved_i[k];
		var itheta = Math.atan2(img_dxdy.data[(i<<1) + 1], img_dxdy.data[i<<1]);
		var ray = [];
		var widths = []
		var step = 1;

		var ix = i % width, iy = Math.floor(i / width);
		while(step < max_concentration){
			var jx = Math.round(ix + Math.cos(itheta) * direction * step);
			var jy = Math.round(iy + Math.sin(itheta) * direction * step);
			step++;
			var j = jy * width + jx;
			
			widths.push(concentration.data[j])
			ray.push(j)			
			
			if(img_canny.data[j] == 0xff) break;
		}
		var median = widths.sort(function(a, b){return a - b})[Math.floor(widths.length / 2)];
		
		for(var j = 0; j < ray.length; j++){
			concentration.data[ray[j]] = nzmin(concentration.data[ray[j]], median)
		}		
	}
	
	return concentration
}

function concentration_contours(concentration, params){
	var dx8 = [-1, 1, -1, 0, 1, -1, 0, 1];
	var dy8 = [0, 0, -1, -1, -1, 1, 1, 1];
	var width = concentration.cols, 
		height = concentration.rows;

	var marker = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)
	var contours = []
	
	for(var i = 0; i < width * height; i++){
		if(marker.data[i] || !concentration.data[i]) continue;

		var ix = i % width, iy = Math.floor(i / width)
		
		marker.data[i] = 1
		var contour = []
		var stack = [i]
		var closed;
		
		while(closed = stack.shift()){
			contour.push(closed)
			var cx = closed % width, cy = Math.floor(closed / width);
			var w = concentration.data[closed];
			for(var k = 0; k < 8; k++){
				var nx = cx + dx8[k]
				var ny = cy + dy8[k]
				var n = ny * width + nx;

				if(nx >= 0 && nx < width &&
				   ny >= 0 && ny < height &&
				   concentration.data[n] &&
				   !marker.data[n] &&
				   concentration.data[n] <= params.concentration_ratio * w &&
				   concentration.data[n] * params.concentration_ratio >= w){
					marker.data[n] = 1
					
					w = (w * stack.length + concentration.data[n]) / (stack.length + 1)
					stack.push(n)
				}
			}
		}
		
		if(contour.length >= params.min_area){
			contours.push(contour)	
		}
	}
	return contours
}




function wrap_words(letters){
	var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
	for(var i = 0; i < letters.length; i++){
		var letter = letters[i];
		x0 = Math.min(x0, letter.x0); y0 = Math.min(y0, letter.y0);
		x1 = Math.max(x1, letter.x1); y1 = Math.max(y1, letter.y1);
	}
	return {
		letters: letters,
		x0: x0,
		y0: y0,
		y1: y1,
		x1: x1,
		cx: x0 + (x1 - x0) / 2,
		cy: y0 + (y1 - y0) / 2,
		width: x1 - x0,
		height: y1 - y0,
		area: (x1 - x0) * (y1 - y0)
	}
}


function wrap_regions(lines){
	lines = lines.sort(function(a, b){ return a.cy - b.cy })

	var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0, sk = 0, sa = 0, sh = 0, sl = 0, st = 0, sxh = 0, ls = 0;
	// console.log(lines.map(function(e){ return e.lettersize }))
	for(var i = 0; i < lines.length; i++){
		var line = lines[i];
		sk += line.angle * line.lettercount; sa += line.lettercount;
		sh += line.lineheight;
		sl += line.lettercount;
		st += line.thickness;
		sxh += line.xheight;
		ls += line.lettersize;
		x0 = Math.min(x0, line.x0); y0 = Math.min(y0, line.y0);
		x1 = Math.max(x1, line.x1); y1 = Math.max(y1, line.y1);
	}
	if(sl < 5 && sk / sa < 0.1){  // this is about 6 angular degrees
		sk = 0
	}
	return {
		lines: lines,
		direction: lines[0].direction,
		angle: sk / sa, // the angle of the paragraph is the weighted average of line angls
		lineheight: sh / lines.length,
		xheight: sxh / lines.length,
		lettercount: sl,
		lettersize: ls / lines.length,
		x0: x0,
		y0: y0,
		thickness: st / lines.length,
		y1: y1,
		x1: x1,
		cx: x0 + (x1 - x0) / 2,
		cy: y0 + (y1 - y0) / 2,
		width: x1 - x0,
		height: y1 - y0,
		area: (x1 - x0) * (y1 - y0)
	}
}




function find_lines(letters){
	console.time("form pairs")
	
	// note that in this instance, it might not actually be necessary
	// to use a heap queue because it turns out that we basically compute
	// a list of elements and then process them, and we dont stick things
	// back onto the queue after processing them so we could probably just
	// get by with making an array and sorting it

	// also it might not be necessary to use the find union algorithm, instead
	// we could just keep track of each element's group number and also keep track 
	// of all the groups because at each merge decision we need to access a list
	// of the elements in the relevant groups anyway, so in this case the 
	// performance benefit of the asymptotically inverse ackermann are probably
	// all but lost

	// in addition all those chain merging weights, there should also be something
	// which prioritizes merging lines which are of similar angles rather than
	// introducing a turn.

	var pair_queue = []

	for(var i = 0; i < letters.length; i++){
		var li = letters[i];
		for(var j = i + 1; j < letters.length; j++){
			var lj = letters[j];

			var ratio = li.thickness / lj.thickness;
			if(ratio > params.thickness_ratio || ratio < 1 / params.thickness_ratio) continue;

			if(Math.max(li.height, lj.height) / Math.min(li.height, lj.height) > params.height_ratio) continue;

			if(Math.max(li.width, lj.width) / Math.min(li.width, lj.width) > 10) continue;

			if(li.x0 < lj.x0 && li.x1 > lj.x1) continue; // one is entirely consumed by another
			if(lj.x0 < li.x0 && lj.x1 > li.x1) continue; // one is entirely consumed by another

			var right = (li.x1 > lj.x1) ? li : lj,
				left = (li.x1 > lj.x1) ? lj : li;
			var w = Math.max(0, Math.max(right.x0, left.x0) - Math.min(right.x1, left.x1)),
				h = Math.max(0, Math.max(right.y0, left.y0) - Math.min(right.y1, left.y1));

			if(w > 2 * Math.max(Math.min(left.height, left.width), Math.min(right.height, right.width))) continue;

			if(h > 10) continue; // 0 would be safer but 10 allows super extreme angles

			var dy = right.cy - left.cy, 
				dx = right.cx - left.cx;

			var slope = dy / dx

			if(Math.abs(slope) > 1) continue; // cap the max slope

			pair_queue.push({
				left: left,
				right: right,
				// dist: w
				// this is meant to bias things toward flatness
				// but this isn't necessarily good because it also flattens
				// things that aren't flat
				// dist: w * w + h
				// dist: Math.sqrt(10 * dy * dy + Math.pow(dx + w, 2)) // euclidean distance ftw
				// dist: Math.sqrt(10 * dy * dy + dx * dx) // euclidean distance ftw
				dist: Math.sqrt(20 * Math.pow(dy + h, 2) + Math.pow(dx + w, 2)) // new thingy
				// dist: Math.sqrt(10 * dy * dy + w * w) // frankendistance
				// this minimizes the x distance and also puts a weight on the y distance
			})
		}
	}


	pair_queue.sort(function(a, b){
		return a.dist - b.dist
	})
	console.timeEnd("form pairs")
	console.time("create lines")

	var groups = []
	for(var i = 0; i < letters.length; i++){
		var letter = letters[i]
		letter.group = groups.length
		groups.push({
			members: [letter]
		})
	}

	// this is like the sum of the absolute value of the second derivative
	// of the center of each letter sorted by x, if two runs of letters
	// get merged together and overlap, then it'll register as a pretty 
	// big ziggometric spike which means that we can exclude those
	// and the second derivative means 
	function zigometer(set){	
		var v_overlap = 2; // this is the allowable vertical extent

		if(set.length < 3) return 0; // cant calculate discrete 2nd deriv of 2 points
		set.sort(function(a, b){ return a.x1 - b.x1 }) // im debating whether this is a better metric than cx
		var last = set[0], lastdy, sigddy = 0;
		for(var i = 1; i < set.length; i++){
			// var dy = set[i].cy - last.cy;
			// var dy = Math.max(0, Math.abs(set[i].cy - last.cy) - Math.max(set[i].height, last.height));
			var dy =  Math.max(v_overlap, Math.max(last.y0, set[i].y0) - Math.min(last.y1, set[i].y1)) - v_overlap
			if(i > 1) sigddy += Math.abs(dy - lastdy);
			lastdy = dy
			last = set[i]
		}
		return 1000 * sigddy
	}

	function zigometer_strict(set){	
		var v_overlap = 2; // this is the allowable vertical extent

		if(set.length < 3) return 0; // cant calculate discrete 2nd deriv of 2 points
		set.sort(function(a, b){ return a.x1 - b.x1 }) // im debating whether this is a better metric than cx
		var last = set[0], lastdy, sigddy = 0;
		for(var i = 1; i < set.length; i++){
			var dy = set[i].cy - last.cy;
			// var dy = Math.max(0, Math.abs(set[i].cy - last.cy) - Math.max(set[i].height, last.height));
			// var dy =  Math.max(v_overlap, Math.max(last.y0, set[i].y0) - Math.min(last.y1, set[i].y1)) - v_overlap
			if(i > 1) sigddy += Math.abs(dy - lastdy);
			lastdy = dy
			last = set[i]
		}
		return 1000 * sigddy
	}
	function measure_angle(letters){
		if(letters.length == 1) return 0;

		var slopes = []
		for(var i = 0; i < letters.length; i++){
			var li = letters[i];
			for(var j = 0; j < i; j++){
				var lj = letters[j];
				slopes.push((li.cy - lj.cy) / (li.cx - lj.cx))
			}
		}
		return Math.atan(slopes.sort(function(a, b){ return a - b })[Math.floor(slopes.length/2)])
	}

	function bounding_box(set){
		var x0 = set[0].x0, y0 = set[0].y0,
			x1 = set[0].x1, y1 = set[0].y1;
		for(var i = 1; i < set.length; i++){
			x0 = Math.min(x0, set[i].x0)
			y0 = Math.min(y0, set[i].y0)
			x1 = Math.max(x1, set[i].x1)
			y1 = Math.max(y1, set[i].y1)
		}
		return {x0: x0, y0: y0, x1: x1, y1: y1, width: x1 - x0, height: y1 - y0}
	}
	function intersects(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		var min_area = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0))
		return (width > 0 && height > 0) && (width * height) > 0.3 * min_area
	}
	var total_length = pair_queue.length;

	while(pair_queue.length){
		var pair = pair_queue.shift()
		
		var left_group = pair.left.group,
			right_group = pair.right.group;
			
		if(left_group == right_group) continue;

		var lca = groups[left_group].members,
			rca = groups[right_group].members;

		var langle = measure_angle(lca),
			rangle = measure_angle(rca);

		var merged = lca.concat(rca).sort(function(a, b){ return a.x1 - b.x1 })

		if(lca.length > 1 || rca.length > 1){
			var zigtotes = zigometer(merged) / (lca.length + rca.length);
			var angtotes = measure_angle(merged)
			
			if(Math.abs(angtotes) > 0.1 + Math.abs(langle) + Math.abs(rangle)) continue;

			if(zigtotes > 0) continue;	

			var r_bb = bounding_box(rca),
				l_bb = bounding_box(lca);

			if(intersects(r_bb, l_bb)) continue;

			var l_height = Math.max.apply(Math, lca.map(function(e){ return e.height }))
			var r_height = Math.max.apply(Math, rca.map(function(e){ return e.height }))
			
			var ratio = Math.max(r_height, l_height) / Math.min(r_height, l_height)

			if(ratio > 1.5 + 10 / Math.max(lca.length, rca.length)) continue;

		}
		for(var i = 0; i < lca.length; i++)
			lca[i].group = right_group;

		groups[right_group].members = merged
		groups[left_group] = null
	}

	console.timeEnd("create lines")
	var lines = groups.filter(function(e){
		return e
	}).map(function(e){
		return e.members
	}).filter(function(e){
		return e.length > 1
	}).map(wrap_lines)
	.filter(function(e){
		return e.lettercount > 3 || (e.lettercount > 2 && Math.abs(e.angle) < 0.1)
	});

	// merge the adjacent lines
	for(var i = 0; i < 2; i++){ // do it twice because sometimes it misses something on the first go
		lines = equivalence_classes(lines, function(r_bb, l_bb){
			var y_overlap = Math.min(r_bb.y1, l_bb.y1) - Math.max(r_bb.y0, l_bb.y0);
			if(y_overlap <= 0) return false;
			var frac_overlap = y_overlap / Math.min(r_bb.height, l_bb.height)
			if(frac_overlap < 0.8) return false;
			var x_dist = Math.max(r_bb.x0, l_bb.x0) - Math.min(r_bb.x1, l_bb.x1)
			if(x_dist < 0) return false;
			if(x_dist > 0.3 * Math.max(r_bb.width, l_bb.width)) return false;

			if(x_dist > 3 * Math.max(r_bb.height, l_bb.height)) return false;

			var max_ang = 0.2; // this merger breaks down with too much angle
			if(Math.abs(r_bb.angle) > max_ang || Math.abs(r_bb.angle) > max_ang) return false;
			
			if(Math.max(r_bb.height, l_bb.height) / Math.min(r_bb.height, l_bb.height) > 1.4) return false;

			// if(Math.abs(r_bb.lettersize - l_bb.lettersize) / Math.min(r_bb.lettersize, l_bb.lettersize) > params.lettersize) return false;

			return true
		}).map(function(cluster){
			if(cluster.length == 1) return cluster[0];
			return wrap_lines([].concat.apply([], cluster.map(function(e){return e.letters})))
		})
	}

	return lines;
}




function calculate_regions(lines){
	console.time("find regions")
	
	// connect together lines which have similar alignment parameters
	var regions = equivalence_classes(lines, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

		// assume that lines within paragraphs of text are either left-aligned, right-aligned or centered
		// (weird font things like justify can just be treated as left-aligned or right-aligned)
		// this means that our metric for align-ed-ness is the minium distance from such an alignment
		var align_offset = Math.min(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.cx - b.cx))
		
		var ratio = a.thickness / b.thickness;
		
		if(ratio > params.thickness_ratio || ratio < 1 / params.thickness_ratio) return false;
		
		if(Math.max(a.height, b.height) / Math.min(a.height, b.height) > 2) return false;

		if( width > 0 && 
			height < params.min_linespacing * (a.height/2 + b.height/2)  &&
			// width > Math.max(a.width, b.width) * 0.2 &&
			// width > Math.min(a.width, b.width) * 0.7 &&
			// -height > params.min_linespacing * Math.min(a.height, b.height) &&
			-height < params.max_linespacing * (a.height/2 + b.height/2) &&
			Math.max(a.avgheight, b.avgheight) / Math.min(a.avgheight, b.avgheight) < 1.7 &&
			align_offset / Math.max(a.width, b.width) < params.max_misalign &&
			Math.abs(a.angle - b.angle) < 0.1 && 
			a.lettercount > 2 && b.lettercount > 2 && 
			Math.abs(a.lettersize - b.lettersize) / Math.min(a.lettersize, b.lettersize) < params.lettersize &&
			Math.abs(a.xheight - b.xheight) / Math.min(a.xheight, b.xheight) < params.lettersize &&
			a.direction == b.direction
			){
				return true;
		}
		return false
	}).map(wrap_regions)

	console.log(regions)

	regions = [].concat.apply([], equivalence_classes(regions, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		if(width > 0 && height > 0 && width * height > 0.2 * Math.min(a.area, b.area)){
			return true;
		}
		return false;
	}).map(function(group){
		// regions can only have lines of one type of direction, but if they're too close
		// then we'll have to merge the regions and abandon the one that's smaller
		var dir = 0, weight = 0;
		function sum(arr){return arr.reduce(function(a,b){return a + b})}

		function score(region){
			// what the fuck does this even do?
			// i don't know
			return sum(equivalence_classes(region.letters, function(a, b){
				var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
					height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
					return(width > -2 && height > -2)
			}).map(function(letters){
				// var avg_weight = sum(letters.map(function(letter){
				// 	// return letter.markweight
				// 	return letter.thickness
				// })) / letters.length
				var avg_weight = letters.map(function(letter){
					// return letter.thickness
					
					return Math.min(
						letter.thickness,
						// this is an upper bound of the stroke width
						// and the stroke width might be vastly larger
						// than what it could possibly be because of the 
						// lack of a second stage con out of performance
						// concerns
						letter.size / Math.min(letter.width, letter.height)
					)
				}).sort(function(a, b){
					return a - b
				})[Math.floor(letters.length / 2)]
				// var avg_weight = region.lettersize
				return avg_weight * Math.sqrt(Math.max.apply(Math, letters.map(function(letter){
					return letter.width
				})))
			}))
		}

		group.forEach(function(col){
			col.lines.forEach(function(line){
				var val = score(line)
				dir += line.direction * val
				weight += val
			})
		})

		dir = Math.round((dir/weight - 0.001) / Math.abs(dir/weight - 0.001))
		
		return group.filter(function(col){
			return col.lines[0].direction == dir
		})
	}))

	// if some vertically adjacent regions have similar line spacing, then
	// they deserve to be merged

	regions = [].concat.apply([], equivalence_classes(regions, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);

		// console.log('regions', a.lines.length + b.lines.length)

		if( a.direction == b.direction && // all cols must be same dir
			Math.abs(a.lettersize - b.lettersize) / Math.min(a.lettersize, b.lettersize) < params.lettersize &&
			a.lines.length + b.lines.length > 2 && // this only works if we have lots of lines in order for the line spacing to be statistically valuable
			width >= 0.9 * Math.min(a.width, b.width) && // needs to have lots of line overlap to assure that one is over another
			height < 0 && -height < 2 * Math.max(a.lineheight, b.lineheight) && // some mild heuristic for how close they have to be
			Math.max(a.lineheight, b.lineheight) / Math.min(a.lineheight, b.lineheight) < 1.5 // they have to be close
			){
			
			var adjs = otsu_adjacent([].concat.apply([], [a, b].map(function(f){ return f.lines })).sort(function(l1, l2){ return l1.cy - l2.cy }), function(cur, next){
				return Math.max(0, next.cy - cur.cy)
			})
			var med = adjs.sort(function(n, m){ return n - m })[Math.floor(adjs.length/2)]
			var mad = adjs.map(function(e){ return Math.abs(e - med)}).reduce(function(n, m){ return n + m }) / adjs.length
			// console.log(mad, 'zad flad')
			if(mad < 2) return true;
		}
		return false;
	}).map(function(e){
		if(e.length == 1) return e;

		var adjs = otsu_adjacent([].concat.apply([], e.map(function(f){ return f.lines })).sort(function(l1, l2){ return l1.cy - l2.cy }), function(cur, next){
			return Math.max(0, next.cy - cur.cy)
		})
		var med = adjs.sort(function(n, m){ return n - m })[Math.floor(adjs.length/2)]
		var mad = adjs.map(function(e){ return Math.abs(e - med)}).reduce(function(n, m){ return n + m }) / adjs.length
		
		if(mad < 2){
			// return true;
			return wrap_regions([].concat.apply([], e.map(function(f){ return f.lines })))
		}else{
			return e
		}
	}))


	// split paragraphs 
	var regions = [].concat.apply([], regions.map(function(col){
		var lines = col.lines;
		// split colums vertically with the otsu threshold for line spacing
		var rows = lines.sort(function(a, b){ return a.cy - b.cy })
		
		var xhs = 0; lines.forEach(function(line){ xhs += line.xheight })
		var mxh = xhs / lines.length;
		return otsu_cluster(rows, function(cur, next){
			// return Math.max(0, med_med(next) - med_med(cur))
			return Math.max(0, next.by - cur.by)
			// return Math.max(0, next.cy - cur.cy)
		}, params.col_breakdown).map(wrap_regions)
	}))

	// merge regions that overlap a lot and i mean really a lot
	regions = [].concat.apply([], equivalence_classes(regions, function(a, b){
		var width = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0),
			height = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
		if(width > 0 && height > 0 
			&& 
			(width * height > params.col_mergethresh * Math.min(a.area, b.area))
			){
			return true;
		}
		return false;
	}).map(function(group){
		// if there are lots of overlaps, then choose the recognized-letter maximizing
		// subset which do not overlap with each other, this is probably something
		// analagous to the knapsack problem which we do not bother actually solving
		function rotbb(line){
			var hyp = line.width / Math.cos(line.angle)
			return {
				x0: line.cx - hyp / 2,
				y0: line.cy - line.lineheight / 2,
				x1: line.cx + hyp / 2,
				y1: line.cy + line.lineheight / 2
			}
		}

		var avg_ang = 0;
		for(var i = 0; i < group.length; i++)
			avg_ang += group[i].angle / group.length;

		if(Math.abs(avg_ang) > 0.1){
			var lines = [].concat.apply([], group.map(function(col){return col.lines}))
			var sorted = lines.sort(function(b, a){
				return a.lettercount - b.lettercount
			});
			var buffer = []
			for(var i = 0; i < sorted.length; i++){
				var can = sorted[i];
				var intersects = buffer.some(function(line){
					var linebb = rotbb(line),
						canbb = rotbb(can);
						
					var width = Math.min(linebb.x1, canbb.x1) - Math.max(linebb.x0, canbb.x0),
						height = Math.min(linebb.y1, canbb.y1) - Math.max(linebb.y0, canbb.y0);

					return (width > 0 && height > 0)
				})

				if(!intersects) buffer.push(can);
			}
			return wrap_regions([].concat.apply([], group.map(function(col){return col.lines})))
		}else{
			var sorted = group.sort(function(b, a){
				return a.lettercount - b.lettercount
			});
			var buffer = []
			for(var i = 0; i < sorted.length; i++){
				var can = sorted[i];
				var intersects = buffer.some(function(col){
						
					var width = Math.min(col.x1, can.x1) - Math.max(col.x0, can.x0),
						height = Math.min(col.y1, can.y1) - Math.max(col.y0, can.y0);

					var lin_area = (col.x1 - col.x0) * (col.y1 - col.y0)
					var can_area = (can.x1 - can.x0) * (can.y1 - can.y0)
					return (width > 0 && height > 0 && width * width > 0.2 * Math.min(lin_area, can_area))
				})

				if(!intersects) buffer.push(can);
			}
			return buffer
		}

		
		
	}))

	console.timeEnd("find regions")

	console.time("break words")

	regions.map(function(col){
		var adjs = col.lines.map(function(line){
			var ln = otsu_adjacent(line.letters, function(cur, next){
				return Math.floor(Math.max(0, next.x0 - cur.x1) / line.height * 10)
			})

			// for long lines, ignore the longest one because it's 
			// probably some punctuation that didn't make it through
			// the connected components thresholding
			if(ln.length > 15) {
				var max = ln.map(function(e, i){ return [e, i] })
							.sort(function(b, a){ return a[0] - b[0] });
				ln = ln.map(function(e, i){
					if(i == max[0][1]) return max[1][0];
					return e
				})
			}
			return ln;
		});
		var stats = otsu([].concat.apply([], adjs));

		col.lines = col.lines.map(function(line, index){
			var words = linear_cluster(line.letters, adjs[index], params.breakdown_ratio, stats);
			
			if(words.length == line.letters.length) words = [line.letters];
			
			var new_line = { words: words.map(wrap_words) }
			for(var prop in line) if(prop != 'letters') new_line[prop] = line[prop];
			return new_line
		})


	})
	console.timeEnd("break words")
	return regions
}



function wrap_lines(letters){
	if(letters.length == 0) return null;

	letters = letters.sort(function(a, b){ return a.cx - b.cx })

	var size = 0;

	var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0, hs = 0;
	for(var i = 0; i < letters.length; i++){
		var letter = letters[i];
		x0 = Math.min(x0, letter.x0); y0 = Math.min(y0, letter.y0);
		x1 = Math.max(x1, letter.x1); y1 = Math.max(y1, letter.y1);
		size += letter.size
		hs += letter.height
	}

	var slopes = []
	// This is an implementation of a Theil-Sen estimator
	// it's like actually really simple, it's just the median
	// of the slopes between every existing pair of points
	for(var i = 0; i < letters.length; i++){
		var li = letters[i];
		for(var j = 0; j < i; j++){
			var lj = letters[j];
			slopes.push((li.y1 - lj.y1) / (li.cx - lj.cx))
		}
	}
	var dydx = slopes.sort(function(a, b){ return a - b })[Math.floor(slopes.length/2)]


	var cx = x0 / 2 + x1 / 2,
		cy = y0 / 2 + y1 / 2;

	var yr0 = Infinity, yr1 = -Infinity, sh = 0, st = 0;
	for(var i = 0; i < letters.length; i++){
		var letter = letters[i];
		var y_pred = (letter.cx - cx) * dydx + cy
		yr0 = Math.min(yr0, letter.y0 - y_pred)
		yr1 = Math.max(yr1, letter.y1 - y_pred)
		sh += letter.height
		st += letter.thickness
	}

	var lettersize = letters.map(function(e){
		return e.size / e.width
	}).sort(function(a, b){return a - b})[Math.floor(letters.length / 2)]


	// approximate the x-height of some line of text
	// as the height of the smallest character whose
	// height is larger than half the average character
	// height
	var xheight = letters.map(function(e){
		return e.height
	}).filter(function(e){
		// return e > (yr1 - yr0) / 3
		return e <= (hs / letters.length)
	}).sort(function(a, b){
		return a - b
	}).slice(-1)[0]

	// this is *not* rotation-safe!
	var baseline = letters.map(function(letter){
		return letter.y1
	}).sort(function(b, a){return a - b})[Math.floor(letters.length / 2)];
	

	return {
		letters: letters,
		lettercount: letters.length,
		lettersize: lettersize,
		// weight: weight,
		size: size,
		lineheight: yr1 - yr0,
		xheight: xheight,
		avgheight: sh / letters.length,
		direction: params.direction,
		// angle: Math.atan2(dy, dx),
		angle: Math.atan(dydx),
		thickness: st / letters.length,
		// r2: r * r,
		x0: x0,
		y0: y0,
		y1: y1,
		x1: x1,

		cx: cx,
		cy: cy,
		by: baseline,
		width: x1 - x0 + 1,
		height: y1 - y0 + 1,
		area: (x1 - x0) * (y1 - y0)
	}
}


function equivalence_classes(elements, is_equal){
	var node = []
	for(var i = 0; i < elements.length; i++){
		node.push({
			parent: 0,
			element: elements[i],
			rank: 0
		})
	}
	for(var i = 0; i < node.length; i++){
		var root = node[i]
		while(root.parent){
			root = root.parent;
		}
		for(var j = 0; j < node.length; j++){
			if(i == j) continue;
			if(!is_equal(node[i].element, node[j].element)) continue;
			var root2 = node[j];
			while(root2.parent){
				root2 = root2.parent;
			}
			if(root2 != root){
				if(root.rank > root2.rank){
					root2.parent = root;
				}else{
					root.parent = root2;
					if(root.rank == root2.rank){
						root2.rank++  
					}
					root = root2;
				}
				var node2 = node[j];
				while(node2.parent){
					var temp = node2;
					node2 = node2.parent;
					temp.parent = root;
				}
				var node2 = node[i];
				while(node2.parent){
					var temp = node2;
					node2 = node2.parent;
					temp.parent = root;
				}
			}
		}
	}
	var index = 0;
	var clusters = [];
	for(var i = 0; i < node.length; i++){
		var j = -1;
		var node1 = node[i]
		while(node1.parent){
			node1 = node1.parent
		}
		if(node1.rank >= 0){
			node1.rank = ~index++;
		}
		j = ~node1.rank;

		if(clusters[j]){
			clusters[j].push(elements[i])
		}else{
			clusters[j] = [elements[i]]
		}
	}
	return clusters;
}


function textdetect(src){
	width = src.width;
	height = src.height;
	
	var img_u8 = new jsfeat.matrix_t(width, height, jsfeat.U8C1_t)
	var img_dxdy = new jsfeat.matrix_t(width, height, jsfeat.S32C2_t);

	console.time("image processing")
	jsfeat.imgproc.grayscale(src.data, img_u8.data)
	jsfeat.imgproc.sobel_derivatives(img_u8, img_dxdy)
	jsfeat.imgproc.gaussian_blur(img_u8, img_u8, params.kernel_size, 0)
	jsfeat.imgproc.canny(img_u8, img_u8, params.low_thresh, params.high_thresh)
	console.timeEnd("image processing")

	params.direction = -1
	var con = per_pixel_concentration(img_u8, img_dxdy, params);

	console.time('connected components')
	contours = concentration_contours(con, params);
	console.timeEnd('connected components')

	function wrap_contours(points){
		var size = points.length;
		var x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
		var m10 = 0, m01 = 0, m11 = 0, m20 = 0, m02 = 0;
		var consum = 0, convar = 0, cons = [];
		var marksum = 0;
		var y_coords = []

		for(var i = 0; i < size; i++){
			var p = points[i];
			var x = p % width, y = Math.floor(p / width);
			x0 = Math.min(x0, x); y0 = Math.min(y0, y);
			x1 = Math.max(x1, x); y1 = Math.max(y1, y);

			y_coords.push(y)

			m10 += x; m01 += y;
			m11 += x * y;
			m20 += x * x; m02 += y * y;
			consum += con.data[p];
			
			// if(marker) marksum += marker.data[p];

			cons.push(con.data[p]);
		}

		var aspect_ratio = Math.max(x1 - x0, y1 - y0) / Math.min(x1 - x0, y1 - y0)
		
		var mean = consum / size;
		
		for(var i = 0; i < size; i++){
			var p = points[i];
			convar += (con.data[p] - mean) * (con.data[p] - mean)
		}
		var xc = m10 / size, yc = m01 / size;
		var af = m20 / size - xc * xc;
		var bf = 2 * (m11 / size - xc * yc)
		var cf = m02 / size - yc * yc;
		var delta = Math.sqrt(bf * bf + (af - cf) * (af - cf));
		var ratio = Math.sqrt((af + cf + delta) / (af + cf - delta));
		ratio = Math.max(ratio, 1 / ratio)

		// if(ratio > params.aspect_ratio && !is_L) return;
		if(ratio > params.aspect_ratio) return;

		var median = cons.sort(function(a, b){return a - b})[Math.floor(cons.length / 2)]
		var std = Math.sqrt(convar / size);
		// if(std > mean * params.std_ratio) return;
		var area = (x1 - x0 + 1) * (y1 - y0 + 1)
		
		if(size / area < 0.1) return;


		var cy = y0 + (y1 - y0) / 2,
			cx = x0 + (x1 - x0) / 2;

		// if(x0 == 0 || y0 == 0 || y1 == height - 1 || x1 == width - 1) return;

		// x-axis border touching is okay because we dont define our 
		// clipping boundaries by them (that doesnt really make sense
		// but im about to go to bed) so like our little chunks are all
		// full width so things touching the edge arent artifacts

		if(y0 == 0 || y1 == height - 1) return;
		
		return {
			x0: x0,
			y0: y0,
			y1: y1,
			x1: x1,
			cx: cx,
			cy: cy,
			width: x1 - x0 + 1,
			height: y1 - y0 + 1,
			size: size,
			// color: dominant_color(colors, direction),
			// color: [sr/size, sg/size, sb/size],
			// color: domcolor,
			ratio: (x1 - x0) / (y1 - y0), 
			ratio2: ratio,
			std: std,
			mean: mean,
			medy: y_coords.sort(function(a, b){ return a - b })[Math.floor(y_coords.length / 2)] - cy,
			area: area,
			contours: points,
			markweight: marksum / size,
			thickness: median
		}
	}
	return contours.map(wrap_contours).filter(function(e){return e})
}



function thresh_compare(a, thresh, direction){
	if(direction == -1){
		return a[0] < thresh[0] && a[1] < thresh[1] && a[2] < thresh[2] 
	}else if(direction == 1){
		return a[0] > thresh[0] && a[1] > thresh[1] && a[2] > thresh[2] 
	}
}

// use otsu's method in order to break up a serial list into runs
// it's really pretty neat that wikipedia implements
// the algorithm in javascript for simple and easy 
// copy pasta powers

function otsu_cluster(list, adjacent, breakdown){
	// this doesn't work for small things
	if(list.length <= 3) return [list];
	var adj = otsu_adjacent(list, adjacent);
	return linear_cluster(list, adj, breakdown, otsu(adj))
}

function otsu_adjacent(list, adjacent){
	var a = [];
	for(var i = 0; i < list.length - 1; i++){
		var n = Math.max(0, adjacent(list[i], list[i + 1])); // negative histograms are nonsensical
		a.push(n)
	}
	return a;
}

function otsu(a){
	var histogram = [], range = 0, sum = 0;
	for(var i = 0; i < a.length; i++){
		var n = a[i];
		if(n >= range) range = n + 1;
		sum += n;
	}
	// initialize histogram
	for(var i = 0; i < range; i++) histogram[i] = 0;
	for(var i = 0; i < a.length; i++) histogram[a[i]]++;
	var sumB = 0;
	var wB = 0, wF = 0, total = a.length;
	var mB, mF, between;
	var max = 0;
	var threshold = 0;
	for (var i = 0; i < histogram.length; ++i) {
		wB += histogram[i];
		if (wB == 0)
			continue;
		wF = total - wB;
		if (wF == 0)
			break;
		sumB += i * histogram[i];
		mB = sumB / wB;
		mF = (sum - sumB) / wF;
		between = wB * wF * Math.pow(mB - mF, 2);
		if (between > max) {
			max = between;
			threshold = i;
		}
	}
	var std = Math.sqrt(max / total / total),
		mean = sum / a.length;
	return {
		std: std,
		mean: mean,
		threshold: threshold
	}
}

function linear_cluster(list, adj, breakdown, stats){
	// default breakdown parameter is an arbitrary magic number
	if(typeof stats == 'undefined'){
		// breakdown is the threshold
		stats = { std: 1, mean: 0, threshold: breakdown }
		breakdown = 0;
	}else{
		if(typeof breakdown == 'undefined') breakdown = 0.5;	
	}
	
	var output = [];
	// console.log(stats.std, stats.mean * breakdown, breakdown, 'merp', list, adj)
	if(stats.std > stats.mean * breakdown){
		// console.log('clustring', stats.threshold)
		var nt = [];
		nt.push(list[0]);
		for(var i = 0; i < list.length - 1; i++){
			if(adj[i] > stats.threshold){
				output.push(nt)
				nt = []
			}
			nt.push(list[i + 1])
		}
		output.push(nt)
	}else{
		// console.log('nope', stats, list, breakdown)
		output.push(list)
	}
	return output
}