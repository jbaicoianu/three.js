THREE.MergedMesh = function() {

	THREE.Object3D.call( this );

	this.materialgroups = {};
	this.submeshes = {};
	this.submeshmap = {};

	this.merge = function(root) {
		root.traverse(elation.bind(this, function(mesh) {
			if (mesh instanceof THREE.Mesh) {
				if (mesh.material && mesh.visible) {
					var materialgroup = this.getMaterialGroup(mesh.material);
					var proxy = materialgroup.merge(mesh);

					// FIXME - this fixes submesh positioning, but might introduce weird behavior...
					proxy.position.copy(root.position);
					proxy.rotation.copy(root.rotation);
					proxy.scale.copy(root.scale);

					// Store a reference to the proxy, and also map the mesh id to its proxy so we can find it quickly later
					this.submeshes[proxy.id] = proxy;
					this.submeshmap[mesh.id] = proxy.id;
					mesh.visible = false;
				}
			}
		}));
	}
	this.unmerge = function(mesh) {
		if (mesh.material) {
			var materialgroup = this.getMaterialGroup(mesh.material);
			materialgroup.unmerge(mesh);

			var proxy = false;
			if (this.submeshmap[mesh.id] && this.submeshes[this.submeshmap[mesh.id]]) {
				proxy = this.submeshes[this.submeshmap[mesh.id]];
			} else if (this.submeshes[mesh.id]) {
				proxy = this.submeshes[mesh.id];
			}

			if (proxy) {
				delete this.submeshes[proxy.id];
			}
		}
	}

	this.getMaterialGroup = function(material) {
		if (!this.materialgroups[material.id]) {
			this.materialgroups[material.id] = new THREE.MergedMeshMaterialgroup(material);
			this.add(this.materialgroups[material.id]);
		}
		return this.materialgroups[material.id];
	}

	this.getMergedGeometry = function(material) {
		var materialgroup = this.getMaterialGroup(material);
		if (materialgroup && materialgroup.mergedmesh.geometry) {
			if (materialgroup.mergedMeshNeedsResize) {
				materialgroup.resizeMergedMesh();
			}
			if (materialgroup.mergedMeshNeedsUpdate) {
				materialgroup.updateMergedMesh();
			}
			return materialgroup.mergedmesh.geometry;
		}
		return false;
	}

	this.forceUpdate = function() {
		for (var k in this.materialgroups) {
			this.materialgroups[k].resizeMergedMesh();
		}
	}

}
THREE.MergedMesh.prototype = Object.create( THREE.Object3D.prototype );

THREE.MergedMeshMaterialgroup = function(material) {
	THREE.Object3D.call(this);

	this.mergedmesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
	this.submeshes = {};
	this.submeshmap = {};

	this.add(this.mergedmesh);

	this.mergedMeshNeedsResize = false;
	this.mergedMeshNeedsUpdate = false;
	this.mergedMeshAttributeNeedsUpdate = {};

	this.updateMatrixWorld = function(force) {
		THREE.Mesh.prototype.updateMatrixWorld.call(this, force);

		if (this.mergedMeshNeedsResize) {
			this.resizeMergedMesh();
		}
		if (this.mergedMeshNeedsUpdate) {
			this.updateMergedMesh();
		}
	}

	this.merge = function(mesh) {
		var proxy = new THREE.MergedSubMesh(mesh);
		this.add(proxy);

		// Keep a map to make it easier to unmerge later
		this.submeshes[proxy.id] = proxy;
		this.submeshmap[mesh.id] = proxy.id;

		this.mergedMeshNeedsResize = true;

		return proxy;
	}
	this.unmerge = function(mesh) {
		var proxy = false;
		if (this.submeshmap[mesh.id] && this.submeshes[this.submeshmap[mesh.id]]) {
			proxy = this.submeshes[this.submeshmap[mesh.id]];
		} else if (this.submeshes[mesh.id]) {
			proxy = this.submeshes[mesh.id];
		}

		if (proxy && proxy.parent) {
			this.remove(proxy);
			delete this.submeshes[proxy.id];
		}
		this.mergedMeshNeedsResize = true;

		return proxy;
	}
	this.resizeMergedMesh = function() {
		var sizes = {};
		var itemsizes = {};

		if (this.mergedmesh && this.mergedmesh.parent) {
			this.mergedmesh.parent.remove(this.mergedmesh);
		}
		this.mergedmesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mergedmesh.material);

		for (var i in this.submeshes) {
			this.submeshes[i].getBufferLengths(sizes);
			this.submeshes[i].getBufferItemSizes(itemsizes);
		}

		for (var k in sizes) {
			var newarray = new Float32Array(sizes[k]);
			var offset = 0;
			for (var i in this.submeshes) {
				var submesh = this.submeshes[i];
				var subgeo = submesh.originalgeometry;
				var subgeolen = submesh.getBufferLength(k);
				if (subgeolen > 0) {
					var subarray = newarray.subarray(offset, offset + subgeolen);
					this.submeshes[i].setMergedBuffer(k, subarray, itemsizes[k]);
					offset += subgeolen;
				}
			}
			this.mergedmesh.geometry.addAttribute(k, newarray, itemsizes[k]);
			this.mergedMeshAttributeNeedsUpdate[k] = true;

		}
		for (var i in this.submeshes) {
			this.submeshes[i].updateMatrix(true);
		}
		if (sizes.position > 0) {
			this.add(this.mergedmesh);
		}
		this.mergedMeshNeedsResize = false;
		this.mergedMeshNeedsUpdate = true;
	}
	this.updateMergedMesh = function() {
		for (var k in this.mergedMeshAttributeNeedsUpdate) {
			if (this.mergedMeshAttributeNeedsUpdate[k]) {
				if (this.mergedmesh.geometry.attributes[k]) {
					this.mergedmesh.geometry.attributes[k].needsUpdate = true;
				}
				//console.log('UPDATED: ', k, this.mergedmesh.geometry.attributes[k]);
				this.mergedMeshAttributeNeedsUpdate[k] = false;
			}
		}
	}
	this.setNeedsUpdate = function(name, val) {
		if (typeof val == 'undefined') val = true;
		this.mergedMeshAttributeNeedsUpdate[name] = val;
		this.mergedMeshNeedsUpdate = true;
	}
	this.getDescendants = function ( array ) {

		if ( array === undefined ) array = [];

		//array.push.apply(this.submeshes);
		for (var i in this.submeshes) {
			array.push(this.submeshes[i]);
		}

		return array;

	}
}
THREE.MergedMeshMaterialgroup.prototype = Object.create( THREE.Object3D.prototype );

THREE.MergedSubMesh = function(mesh) {

	this.originalgeometry = THREE.BufferGeometryUtils.fromGeometry(mesh.geometry);
	THREE.Mesh.call(this, new THREE.BufferGeometry(), mesh.material);
	mesh.clone(this, false);

	this.position = mesh.position;
	this._rotation = mesh._rotation;
	this._quaternion = mesh._quaternion;
	this.matrix = mesh.matrix;
	this.matrixWorld = mesh.matrixWorld;
	this.visible = false;
	this.laststate = [];

	this.updateMatrix = function (force) {
		this.matrix.compose( this.position, this.quaternion, this.scale );

		this.matrixWorldNeedsUpdate = true;

		if (force || this.needsUpdate()) {
			this.updateMergedBuffer();
			this.updateLastState();
		}
	}

	this.needsUpdate = function() {
		if (this.laststate[0] != this.position.x) return true;
		if (this.laststate[1] != this.position.y) return true;
		if (this.laststate[2] != this.position.z) return true;
		if (this.laststate[3] != this.rotation.x) return true;
		if (this.laststate[4] != this.rotation.y) return true;
		if (this.laststate[5] != this.rotation.z) return true;
		if (this.laststate[6] != this.scale.x) return true;
		if (this.laststate[7] != this.scale.y) return true;
		if (this.laststate[8] != this.scale.z) return true;
		return false;
	}
	this.updateLastState = function() {
		this.laststate[0] = this.position.x;
		this.laststate[1] = this.position.y;
		this.laststate[2] = this.position.z;
		this.laststate[3] = this.rotation.x;
		this.laststate[4] = this.rotation.y;
		this.laststate[5] = this.rotation.z;
		this.laststate[6] = this.scale.x;
		this.laststate[7] = this.scale.y;
		this.laststate[8] = this.scale.z;
	}

	this.getBufferLength = function(name) {
		if (this.originalgeometry instanceof THREE.BufferGeometry) {
			if (this.originalgeometry.attributes[name]) {
				return this.originalgeometry.attributes[name].array.length;
			}
		} else if (this.originalgeometry instanceof THREE.Geometry) {
			switch (name) {
				case 'position':
				case 'normal':
					return this.originalgeometry.vertices.length;
				case 'uv':
					return this.originalgeometry.faceVertexUvs[0].length;
			}
		}
		return 0;
	}
	this.getBufferLengths = function(count) {
		if (typeof count == 'undefined') {
			count = {};
		}
		if (this.originalgeometry instanceof THREE.BufferGeometry) {
			for (var k in this.originalgeometry.attributes) {
				var cnt = this.getBufferLength(k);
				if (!count[k]) count[k] = 0;
				count[k] += cnt;

				//itemsizes[k] = geo.attributes[k].itemSize; // FIXME - can itemsize ever vary between objects?
			}
		} else if (this.originalgeometry instanceof THREE.Geometry) {
			count.position = (count.position || 0) + this.getBufferLength('position');
			count.normal = (count.normal || 0) + this.getBufferLength('normal');
			count.uv = (count.uv || 0) + this.getBufferLength('uv');
		}
		return count;
	}
	this.getBufferItemSizes = function(sizes) {
		if (typeof sizes == 'undefined') {
			sizes = {};
		}
		if (this.originalgeometry instanceof THREE.BufferGeometry) {
			for (var k in this.originalgeometry.attributes) {
				sizes[k] = this.originalgeometry.attributes[k].itemSize; // FIXME - can itemsize ever vary between objects?
			}
		} else if (this.originalgeometry instanceof THREE.Geometry) {
			sizes.position = 3;
			sizes.normal = 3;
			sizes.uv = 2;
		}
		return sizes;
	}

	this.setMergedBuffer = function(name, array, itemsize) {
		if (this.geometry.attributes[name]) {
			this.geometry.attributes[name].array = array;
		} else {
			this.geometry.addAttribute(name, array, itemsize);
		}
		if (this.originalgeometry instanceof THREE.BufferGeometry) {
			array.set(this.originalgeometry.attributes[name].array);
		}
		this.geometry.attributes[name].needsUpdate = true;
	}
	this.updateMergedBuffer = (function() {
		var tmpvec = new THREE.Vector3();
		var normalMatrix = new THREE.Matrix3();

		return function() {

			// Bail early if we haven't had our position attribute initialized yet
			if (!this.geometry.attributes.position) return;

			normalMatrix.getNormalMatrix( this.matrix );

			if (this.originalgeometry instanceof THREE.BufferGeometry) {

				var originalpositions = this.originalgeometry.attributes.position;
				for (var i = 0, l = originalpositions.array.length; i < l; i += 3) {
					tmpvec.set(originalpositions.array[i], originalpositions.array[i+1], originalpositions.array[i+2]);
					tmpvec.applyMatrix4(this.matrix);

					this.geometry.attributes.position.array[i] = tmpvec.x;
					this.geometry.attributes.position.array[i+1] = tmpvec.y;
					this.geometry.attributes.position.array[i+2] = tmpvec.z;
				}

				var originalnormals = this.originalgeometry.attributes.normal;
				for (var i = 0, l = originalnormals.array.length; i < l; i += 3) {
					tmpvec.set(originalnormals.array[i], originalnormals.array[i+1], originalnormals.array[i+2]);
					tmpvec.applyMatrix3(normalMatrix);

					this.geometry.attributes.normal.array[i] = tmpvec.x;
					this.geometry.attributes.normal.array[i+1] = tmpvec.y;
					this.geometry.attributes.normal.array[i+2] = tmpvec.z;
				}
			} else if (this.originalgeometry instanceof THREE.Geometry) {
				var originalvertices = this.originalgeometry.vertices;
				for (var i = 0, l = originalvertices.length; i < l; i++) {
					tmpvec.copy(originalvertices[i])
					tmpvec.applyMatrix4(this.matrix);

					this.geometry.attributes.position.array[i] = tmpvec.x;
					this.geometry.attributes.position.array[i+1] = tmpvec.y;
					this.geometry.attributes.position.array[i+2] = tmpvec.z;

/*
					var originalnormals = this.originalgeometry.normals;
					for (var i = 0, l = originalnormals.length; i < l; i += 3) {
						tmpvec.copy(originalnormals[i]).applyMatrix3(normalMatrix);

						this.geometry.attributes.normal.array[i] = tmpvec.x;
						this.geometry.attributes.normal.array[i+1] = tmpvec.y;
						this.geometry.attributes.normal.array[i+2] = tmpvec.z;
					}
*/
				}
			}

			this.parent.setNeedsUpdate('position');
			this.parent.setNeedsUpdate('normal');
		}
	})();
}
THREE.MergedSubMesh.prototype = Object.create( THREE.Mesh.prototype );
