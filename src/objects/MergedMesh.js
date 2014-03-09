THREE.MergedMesh = function() {

	THREE.Object3D.call( this );

	this.materialgroups = {};
  this.submeshes = {};
  this.submeshmap = {};

	this.merge = function(mesh) {
		if (mesh.material) {
			var materialgroup = this.getMaterialGroup(mesh.material);
			var proxy = materialgroup.merge(mesh);
			//this.add(proxy);
      // Store a reference to the proxy, and also map the mesh id to its proxy so we can find it quickly later
      this.submeshes[proxy.id] = proxy;
      this.submeshmap[mesh.id] = proxy.id;
		}
	}
  this.unmerge = function(mesh) {
    var proxy = false;
    if (this.submeshmap[mesh.id] && this.submeshes[this.submeshmap[mesh.id]]) {
      proxy = this.submeshes[this.submeshmap[mesh.id]];
    } else if (this.submeshes[mesh.id]) {
      proxy = this.submeshes[mesh.id];
    }

    if (proxy && proxy.parent) {
console.log('found a proxy, remove it!', proxy);
      proxy.parent.remove(proxy);
    }
  }

	this.getMaterialGroup = function(material) {
		if (!this.materialgroups[material.id]) {
			this.materialgroups[material.id] = new THREE.MergedMeshMaterialgroup(material);
			this.add(this.materialgroups[material.id]);
		}
		return this.materialgroups[material.id];
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
	this.submeshes = [];

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
		this.submeshes.push(proxy);

		return proxy;
	}
	this.resizeMergedMesh = function() {
		var sizes = {};
		var itemsizes = {};
		for (var i = 0; i < this.submeshes.length; i++) {
			var geo = this.submeshes[i].originalgeometry;
			if (geo instanceof THREE.BufferGeometry) {
				for (var k in geo.attributes) {
					var cnt = geo.attributes[k].array.length;
					if (!sizes[k]) sizes[k] = 0;
					sizes[k] += cnt;

					itemsizes[k] = geo.attributes[k].itemSize; // FIXME - can itemsize ever vary between objects?
				}
			}
		}

		for (var k in sizes) {
			var newarray = new Float32Array(sizes[k]);
			var offset = 0;
			for (var i = 0; i < this.submeshes.length; i++) {
				var submesh = this.submeshes[i];
				var subgeo = submesh.originalgeometry;
				if (subgeo.attributes[k] && subgeo.attributes[k].array.length > 0) {
					var subgeolen = submesh.getBufferLength(k);
					var subarray = newarray.subarray(offset, offset + subgeolen);
					this.submeshes[i].setMergedBuffer(k, subarray, itemsizes[k]);
					offset += subgeolen;
				}
			}
			this.mergedmesh.geometry.addAttribute(k, newarray, itemsizes[k]);
		}
		this.mergedMeshNeedsResize = false;
		this.mergedMeshNeedsUpdate = true;
console.log('RESIZED');
	}
	this.updateMergedMesh = function() {
		for (var k in this.mergedMeshAttributeNeedsUpdate) {
			if (this.mergedMeshAttributeNeedsUpdate[k]) {
				//console.log('UPDATED: ', k, this.mergedMeshAttributeNeedsUpdate);
				this.mergedmesh.geometry.attributes[k].needsUpdate = true;
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

		array.push.apply(this.submeshes);

		/*
		for ( var i = 0, l = this.children.length; i < l; i ++ ) {

			if (this.children[i] instanceof THREE.MergedSubMesh) {
				array.push(this.children[i]);
				this.children[ i ].getDescendants( array );
			}

		}
		*/

		return array;

	}
}
THREE.MergedMeshMaterialgroup.prototype = Object.create( THREE.Object3D.prototype );

THREE.MergedSubMesh = function(mesh) {

	this.originalgeometry = mesh.geometry;
	THREE.Mesh.call(this, new THREE.BufferGeometry(), mesh.material);
	mesh.clone(this);

	this.position = mesh.position;
	this._rotation = mesh._rotation;
	this._quaternion = mesh._quaternion;
	this.matrix = mesh.matrix;
	this.matrixWorld = mesh.matrixWorld;
	this.visible = false;
	this.laststate = [];

	this.updateMatrix = function () {
		this.matrix.compose( this.position, this.quaternion, this.scale );

		this.matrixWorldNeedsUpdate = true;

		if (this.needsUpdate()) {
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
		}
		return 0;
	}

	this.setMergedBuffer = function(name, array, itemsize) {
		if (this.geometry.attributes[name]) {
			this.geometry.attributes[name].array = array;
		} else {
			this.geometry.addAttribute(name, array, itemsize);
		}
		array.set(this.originalgeometry.attributes[name].array);
		this.geometry.attributes[name].needsUpdate = true;
	}
	this.updateMergedBuffer = (function() {
		var tmpvec = new THREE.Vector3();
		var normalMatrix = new THREE.Matrix3();

		return function() {
			var originalpositions = this.originalgeometry.attributes.position;
			for (var i = 0, l = originalpositions.array.length; i < l; i += 3) {
				tmpvec.set(originalpositions.array[i], originalpositions.array[i+1], originalpositions.array[i+2]);
				tmpvec.applyMatrix4(this.matrix);

				this.geometry.attributes.position.array[i] = tmpvec.x;
				this.geometry.attributes.position.array[i+1] = tmpvec.y;
				this.geometry.attributes.position.array[i+2] = tmpvec.z;
			}

			var originalnormals = this.originalgeometry.attributes.normal;
			normalMatrix.getNormalMatrix( this.matrix );
			for (var i = 0, l = originalnormals.array.length; i < l; i += 3) {
				tmpvec.set(originalnormals.array[i], originalnormals.array[i+1], originalnormals.array[i+2]);
				tmpvec.applyMatrix3(normalMatrix);

				this.geometry.attributes.normal.array[i] = tmpvec.x;
				this.geometry.attributes.normal.array[i+1] = tmpvec.y;
				this.geometry.attributes.normal.array[i+2] = tmpvec.z;
			}

			this.parent.setNeedsUpdate('position');
			this.parent.setNeedsUpdate('normal');
		}
	})();
}
THREE.MergedSubMesh.prototype = Object.create( THREE.Mesh.prototype );
