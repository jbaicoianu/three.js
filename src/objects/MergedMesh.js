THREE.MergedMesh = function() {

  THREE.Object3D.call( this );

  this.materialgroups = {};

  this.merge = function(mesh) {
    if (mesh.material) {
      var materialgroup = this.getMaterialGroup(mesh.material);
      var proxy = materialgroup.merge(mesh);
      //this.add(proxy);
    }
  }

  this.getMaterialGroup = function(material) {
    if (!this.materialgroups[material.id]) {
      this.materialgroups[material.id] = new THREE.MergedMeshMaterialgroup(material);
      this.add(this.materialgroups[material.id]);
    }
    return this.materialgroups[material.id];
  }

}
THREE.MergedMesh.prototype = Object.create( THREE.Object3D.prototype );

THREE.MergedMeshMaterialgroup = function(material) {
  THREE.Object3D.call(this);

  this.subobjects = [];

  this.mergedgeometry = new THREE.BufferGeometry();
  this.add(new THREE.Mesh(this.mergedgeometry, material));

  this.updateMatrixWorld = function(force) {
    THREE.Mesh.prototype.updateMatrixWorld.call(this, force);

    if (this.mergedgeometry.attributes.position) {
      this.mergedgeometry.attributes.position.needsUpdate = true;
    }
  }

  this.merge = function(mesh) {
    var proxy = false;
    var geom = mesh.geometry;
    if (geom instanceof THREE.BufferGeometry) {
      for (var k in geom.attributes) {
        var myattr = this.mergedgeometry.getAttribute(k);
        var newattr = geom.getAttribute(k);

        var newlength = newattr.array.length;
        var itemsize = newattr.itemSize;
        var currentlength = 0;

        if (myattr) {
          currentlength = myattr.array.length;
          newlength += currentlength;
          itemsize = newattr.itemSize; // TODO - what do we do if itemSize is different?  For now we prefer our own
        }

        var newarray = new Float32Array(newlength);

        if (myattr) {
          newarray.set(myattr.array);
        }
        newarray.set(newattr.array, currentlength);
        this.mergedgeometry.addAttribute(k, newarray, itemsize);
      }

      proxy = new THREE.MergedSubMesh(mesh);
      this.add(proxy);
      this.updateSubarrays();

      proxy.updateMatrix();
      proxy.updateMatrixWorld();
      this.mergedgeometry.attributes.position.needsUpdate = true;
    }
    return proxy;
  }
  this.updateSubarrays = function() {
    var offset = 0;
    for (var k in this.children) {
      var obj = this.children[k];
      if (obj instanceof THREE.MergedSubMesh) {
        var vertices = obj.geometry.attributes.position;
        var newsize = obj.originalgeometry.attributes.position.array.length;
        var newsubarray = this.mergedgeometry.attributes.position.array.subarray(offset, offset + newsize);

        if (vertices) {
          vertices.array = newsubarray;
          vertices.needsUpdate = true;
        } else {
          obj.geometry.addAttribute('position', newsubarray);
        }
        offset += newsize;
      }
    }
  }
  this.getDescendants = function ( array ) {

    if ( array === undefined ) array = [];


    for ( var i = 0, l = this.children.length; i < l; i ++ ) {

      if (this.children[i] instanceof THREE.MergedSubMesh) {
        array.push(this.children[i]);
        this.children[ i ].getDescendants( array );
      }

    }

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

  this.updateMatrix = function () {
    this.matrix.compose( this.position, this.quaternion, this.scale );

    this.matrixWorldNeedsUpdate = true;

    this.updateMergedBuffer();

  }

  this.updateMergedBuffer = (function() {
    var tmpvec = new THREE.Vector3();

    return function() {
      var originalpositions = this.originalgeometry.attributes.position;
      for (var i = 0, l = originalpositions.array.length; i < l; i += 3) {
        tmpvec.set(originalpositions.array[i], originalpositions.array[i+1], originalpositions.array[i+2]);
        tmpvec.applyMatrix4(this.matrix);

        this.geometry.attributes.position.array[i] = tmpvec.x;
        this.geometry.attributes.position.array[i+1] = tmpvec.y;
        this.geometry.attributes.position.array[i+2] = tmpvec.z;
//console.log(i, tmpvec.toArray());
      }
//console.log('poop', this);
    }
  })();
}
THREE.MergedSubMesh.prototype = Object.create( THREE.Mesh.prototype );
