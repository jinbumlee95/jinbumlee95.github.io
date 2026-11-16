import { r as reactExports, m as makeModel, q as questionBounds, j as jsxRuntimeExports, a as mix } from './index-B93atiG3.js';
import { C as Controls, V as Vector3, M as MOUSE, T as TOUCH, Q as Quaternion, S as Spherical, a as Vector2, R as Ray, P as Plane, b as MathUtils, W as WebGLRenderer, c as Scene, O as OrthographicCamera, G as Group, d as ShapeUtils, B as BufferGeometry, F as Float32BufferAttribute, e as Mesh, f as MeshBasicMaterial, D as DoubleSide, g as SphereGeometry, h as CircleGeometry, I as InstancedMesh, i as Matrix4, j as RingGeometry, L as LineDashedMaterial, k as LineBasicMaterial, l as Line, m as CanvasTexture, n as Sprite, o as SpriteMaterial } from './three-wsrMSkrV.js';
import './math-CrGqW7vb.js';

/**
 * Fires when the camera has been transformed by the controls.
 *
 * @event OrbitControls#change
 * @type {Object}
 */
const _changeEvent = { type: 'change' };

/**
 * Fires when an interaction was initiated.
 *
 * @event OrbitControls#start
 * @type {Object}
 */
const _startEvent = { type: 'start' };

/**
 * Fires when an interaction has finished.
 *
 * @event OrbitControls#end
 * @type {Object}
 */
const _endEvent = { type: 'end' };

const _ray = new Ray();
const _plane = new Plane();
const _TILT_LIMIT = Math.cos( 70 * MathUtils.DEG2RAD );

const _v = new Vector3();
const _twoPI = 2 * Math.PI;

const _STATE = {
	NONE: -1,
	ROTATE: 0,
	DOLLY: 1,
	PAN: 2,
	TOUCH_ROTATE: 3,
	TOUCH_PAN: 4,
	TOUCH_DOLLY_PAN: 5,
	TOUCH_DOLLY_ROTATE: 6
};
const _EPS = 0.000001;


/**
 * Orbit controls allow the camera to orbit around a target.
 *
 * OrbitControls performs orbiting, dollying (zooming), and panning. Unlike {@link TrackballControls},
 * it maintains the "up" direction `object.up` (+Y by default).
 *
 * - Orbit: Left mouse / touch: one-finger move.
 * - Zoom: Middle mouse, or mousewheel / touch: two-finger spread or squish.
 * - Pan: Right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move.
 *
 * ```js
 * const controls = new OrbitControls( camera, renderer.domElement );
 *
 * // controls.update() must be called after any manual changes to the camera's transform
 * camera.position.set( 0, 20, 100 );
 * controls.update();
 *
 * function animate() {
 *
 * 	// required if controls.enableDamping or controls.autoRotate are set to true
 * 	controls.update();
 *
 * 	renderer.render( scene, camera );
 *
 * }
 * ```
 *
 * @augments Controls
 * @three_import import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
 */
class OrbitControls extends Controls {

	/**
	 * Constructs a new controls instance.
	 *
	 * @param {Object3D} object - The object that is managed by the controls.
	 * @param {?HTMLDOMElement} domElement - The HTML element used for event listeners.
	 */
	constructor( object, domElement = null ) {

		super( object, domElement );

		this.state = _STATE.NONE;

		/**
		 * The focus point of the controls, the `object` orbits around this.
		 * It can be updated manually at any point to change the focus of the controls.
		 *
		 * @type {Vector3}
		 */
		this.target = new Vector3();

		/**
		 * The focus point of the `minTargetRadius` and `maxTargetRadius` limits.
		 * It can be updated manually at any point to change the center of interest
		 * for the `target`.
		 *
		 * @type {Vector3}
		 */
		this.cursor = new Vector3();

		/**
		 * How far you can dolly in (perspective camera only).
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minDistance = 0;

		/**
		 * How far you can dolly out (perspective camera only).
		 *
		 * @type {number}
		 * @default Infinity
		 */
		this.maxDistance = Infinity;

		/**
		 * How far you can zoom in (orthographic camera only).
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minZoom = 0;

		/**
		 * How far you can zoom out (orthographic camera only).
		 *
		 * @type {number}
		 * @default Infinity
		 */
		this.maxZoom = Infinity;

		/**
		 * How close you can get the target to the 3D `cursor`.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minTargetRadius = 0;

		/**
		 * How far you can move the target from the 3D `cursor`.
		 *
		 * @type {number}
		 * @default Infinity
		 */
		this.maxTargetRadius = Infinity;

		/**
		 * How far you can orbit vertically, lower limit. Range is `[0, Math.PI]` radians.
		 *
		 * @type {number}
		 * @default 0
		 */
		this.minPolarAngle = 0;

		/**
		 * How far you can orbit vertically, upper limit. Range is `[0, Math.PI]` radians.
		 *
		 * @type {number}
		 * @default Math.PI
		 */
		this.maxPolarAngle = Math.PI;

		/**
		 * How far you can orbit horizontally, lower limit. If set, the interval `[ min, max ]`
		 * must be a sub-interval of `[ - 2 PI, 2 PI ]`, with `( max - min < 2 PI )`.
		 *
		 * @type {number}
		 * @default -Infinity
		 */
		this.minAzimuthAngle = - Infinity;

		/**
		 * How far you can orbit horizontally, upper limit. If set, the interval `[ min, max ]`
		 * must be a sub-interval of `[ - 2 PI, 2 PI ]`, with `( max - min < 2 PI )`.
		 *
		 * @type {number}
		 * @default -Infinity
		 */
		this.maxAzimuthAngle = Infinity;

		/**
		 * Set to `true` to enable damping (inertia), which can be used to give a sense of weight
		 * to the controls. Note that if this is enabled, you must call `update()` in your animation
		 * loop.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.enableDamping = false;

		/**
		 * The damping inertia used if `enableDamping` is set to `true`.
		 *
		 * Note that for this to work, you must call `update()` in your animation loop.
		 *
		 * @type {number}
		 * @default 0.05
		 */
		this.dampingFactor = 0.05;

		/**
		 * Enable or disable zooming (dollying) of the camera.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.enableZoom = true;

		/**
		 * Speed of zooming / dollying.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.zoomSpeed = 1.0;

		/**
		 * Enable or disable horizontal and vertical rotation of the camera.
		 *
		 * Note that it is possible to disable a single axis by setting the min and max of the
		 * `minPolarAngle` or `minAzimuthAngle` to the same value, which will cause the vertical
		 * or horizontal rotation to be fixed at that value.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.enableRotate = true;

		/**
		 * Speed of rotation.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.rotateSpeed = 1.0;

		/**
		 * How fast to rotate the camera when the keyboard is used.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.keyRotateSpeed = 1.0;

		/**
		 * Enable or disable camera panning.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.enablePan = true;

		/**
		 * Speed of panning.
		 *
		 * @type {number}
		 * @default 1
		 */
		this.panSpeed = 1.0;

		/**
		 * Defines how the camera's position is translated when panning. If `true`, the camera pans
		 * in screen space. Otherwise, the camera pans in the plane orthogonal to the camera's up
		 * direction.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.screenSpacePanning = true;

		/**
		 * How fast to pan the camera when the keyboard is used in
		 * pixels per keypress.
		 *
		 * @type {number}
		 * @default 7
		 */
		this.keyPanSpeed = 7.0;

		/**
		 * Setting this property to `true` allows to zoom to the cursor's position.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.zoomToCursor = false;

		/**
		 * Set to true to automatically rotate around the target
		 *
		 * Note that if this is enabled, you must call `update()` in your animation loop.
		 * If you want the auto-rotate speed to be independent of the frame rate (the refresh
		 * rate of the display), you must pass the time `deltaTime`, in seconds, to `update()`.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.autoRotate = false;

		/**
		 * How fast to rotate around the target if `autoRotate` is `true`. The default  equates to 30 seconds
		 * per orbit at 60fps.
		 *
		 * Note that if `autoRotate` is enabled, you must call `update()` in your animation loop.
		 *
		 * @type {number}
		 * @default 2
		 */
		this.autoRotateSpeed = 2.0;

		/**
		 * This object contains references to the keycodes for controlling camera panning.
		 *
		 * ```js
		 * controls.keys = {
		 * 	LEFT: 'ArrowLeft', //left arrow
		 * 	UP: 'ArrowUp', // up arrow
		 * 	RIGHT: 'ArrowRight', // right arrow
		 * 	BOTTOM: 'ArrowDown' // down arrow
		 * }
		 * ```
		 * @type {Object}
		 */
		this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

		/**
		 * This object contains references to the mouse actions used by the controls.
		 *
		 * ```js
		 * controls.mouseButtons = {
		 * 	LEFT: THREE.MOUSE.ROTATE,
		 * 	MIDDLE: THREE.MOUSE.DOLLY,
		 * 	RIGHT: THREE.MOUSE.PAN
		 * }
		 * ```
		 * @type {Object}
		 */
		this.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };

		/**
		 * This object contains references to the touch actions used by the controls.
		 *
		 * ```js
		 * controls.mouseButtons = {
		 * 	ONE: THREE.TOUCH.ROTATE,
		 * 	TWO: THREE.TOUCH.DOLLY_PAN
		 * }
		 * ```
		 * @type {Object}
		 */
		this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

		/**
		 * Used internally by `saveState()` and `reset()`.
		 *
		 * @type {Vector3}
		 */
		this.target0 = this.target.clone();

		/**
		 * Used internally by `saveState()` and `reset()`.
		 *
		 * @type {Vector3}
		 */
		this.position0 = this.object.position.clone();

		/**
		 * Used internally by `saveState()` and `reset()`.
		 *
		 * @type {number}
		 */
		this.zoom0 = this.object.zoom;

		// the target DOM element for key events
		this._domElementKeyEvents = null;

		// internals

		this._lastPosition = new Vector3();
		this._lastQuaternion = new Quaternion();
		this._lastTargetPosition = new Vector3();

		// so camera.up is the orbit axis
		this._quat = new Quaternion().setFromUnitVectors( object.up, new Vector3( 0, 1, 0 ) );
		this._quatInverse = this._quat.clone().invert();

		// current position in spherical coordinates
		this._spherical = new Spherical();
		this._sphericalDelta = new Spherical();

		this._scale = 1;
		this._panOffset = new Vector3();

		this._rotateStart = new Vector2();
		this._rotateEnd = new Vector2();
		this._rotateDelta = new Vector2();

		this._panStart = new Vector2();
		this._panEnd = new Vector2();
		this._panDelta = new Vector2();

		this._dollyStart = new Vector2();
		this._dollyEnd = new Vector2();
		this._dollyDelta = new Vector2();

		this._dollyDirection = new Vector3();
		this._mouse = new Vector2();
		this._performCursorZoom = false;

		this._pointers = [];
		this._pointerPositions = {};

		this._controlActive = false;

		// event listeners

		this._onPointerMove = onPointerMove.bind( this );
		this._onPointerDown = onPointerDown.bind( this );
		this._onPointerUp = onPointerUp.bind( this );
		this._onContextMenu = onContextMenu.bind( this );
		this._onMouseWheel = onMouseWheel.bind( this );
		this._onKeyDown = onKeyDown.bind( this );

		this._onTouchStart = onTouchStart.bind( this );
		this._onTouchMove = onTouchMove.bind( this );

		this._onMouseDown = onMouseDown.bind( this );
		this._onMouseMove = onMouseMove.bind( this );

		this._interceptControlDown = interceptControlDown.bind( this );
		this._interceptControlUp = interceptControlUp.bind( this );

		//

		if ( this.domElement !== null ) {

			this.connect( this.domElement );

		}

		this.update();

	}

	connect( element ) {

		super.connect( element );

		this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.addEventListener( 'pointercancel', this._onPointerUp );

		this.domElement.addEventListener( 'contextmenu', this._onContextMenu );
		this.domElement.addEventListener( 'wheel', this._onMouseWheel, { passive: false } );

		const document = this.domElement.getRootNode(); // offscreen canvas compatibility
		document.addEventListener( 'keydown', this._interceptControlDown, { passive: true, capture: true } );

		this.domElement.style.touchAction = 'none'; // disable touch scroll

	}

	disconnect() {

		this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
		this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
		this.domElement.removeEventListener( 'pointerup', this._onPointerUp );
		this.domElement.removeEventListener( 'pointercancel', this._onPointerUp );

		this.domElement.removeEventListener( 'wheel', this._onMouseWheel );
		this.domElement.removeEventListener( 'contextmenu', this._onContextMenu );

		this.stopListenToKeyEvents();

		const document = this.domElement.getRootNode(); // offscreen canvas compatibility
		document.removeEventListener( 'keydown', this._interceptControlDown, { capture: true } );

		this.domElement.style.touchAction = 'auto';

	}

	dispose() {

		this.disconnect();

	}

	/**
	 * Get the current vertical rotation, in radians.
	 *
	 * @return {number} The current vertical rotation, in radians.
	 */
	getPolarAngle() {

		return this._spherical.phi;

	}

	/**
	 * Get the current horizontal rotation, in radians.
	 *
	 * @return {number} The current horizontal rotation, in radians.
	 */
	getAzimuthalAngle() {

		return this._spherical.theta;

	}

	/**
	 * Returns the distance from the camera to the target.
	 *
	 * @return {number} The distance from the camera to the target.
	 */
	getDistance() {

		return this.object.position.distanceTo( this.target );

	}

	/**
	 * Adds key event listeners to the given DOM element.
	 * `window` is a recommended argument for using this method.
	 *
	 * @param {HTMLDOMElement} domElement - The DOM element
	 */
	listenToKeyEvents( domElement ) {

		domElement.addEventListener( 'keydown', this._onKeyDown );
		this._domElementKeyEvents = domElement;

	}

	/**
	 * Removes the key event listener previously defined with `listenToKeyEvents()`.
	 */
	stopListenToKeyEvents() {

		if ( this._domElementKeyEvents !== null ) {

			this._domElementKeyEvents.removeEventListener( 'keydown', this._onKeyDown );
			this._domElementKeyEvents = null;

		}

	}

	/**
	 * Save the current state of the controls. This can later be recovered with `reset()`.
	 */
	saveState() {

		this.target0.copy( this.target );
		this.position0.copy( this.object.position );
		this.zoom0 = this.object.zoom;

	}

	/**
	 * Reset the controls to their state from either the last time the `saveState()`
	 * was called, or the initial state.
	 */
	reset() {

		this.target.copy( this.target0 );
		this.object.position.copy( this.position0 );
		this.object.zoom = this.zoom0;

		this.object.updateProjectionMatrix();
		this.dispatchEvent( _changeEvent );

		this.update();

		this.state = _STATE.NONE;

	}

	update( deltaTime = null ) {

		const position = this.object.position;

		_v.copy( position ).sub( this.target );

		// rotate offset to "y-axis-is-up" space
		_v.applyQuaternion( this._quat );

		// angle from z-axis around y-axis
		this._spherical.setFromVector3( _v );

		if ( this.autoRotate && this.state === _STATE.NONE ) {

			this._rotateLeft( this._getAutoRotationAngle( deltaTime ) );

		}

		if ( this.enableDamping ) {

			this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor;
			this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor;

		} else {

			this._spherical.theta += this._sphericalDelta.theta;
			this._spherical.phi += this._sphericalDelta.phi;

		}

		// restrict theta to be between desired limits

		let min = this.minAzimuthAngle;
		let max = this.maxAzimuthAngle;

		if ( isFinite( min ) && isFinite( max ) ) {

			if ( min < - Math.PI ) min += _twoPI; else if ( min > Math.PI ) min -= _twoPI;

			if ( max < - Math.PI ) max += _twoPI; else if ( max > Math.PI ) max -= _twoPI;

			if ( min <= max ) {

				this._spherical.theta = Math.max( min, Math.min( max, this._spherical.theta ) );

			} else {

				this._spherical.theta = ( this._spherical.theta > ( min + max ) / 2 ) ?
					Math.max( min, this._spherical.theta ) :
					Math.min( max, this._spherical.theta );

			}

		}

		// restrict phi to be between desired limits
		this._spherical.phi = Math.max( this.minPolarAngle, Math.min( this.maxPolarAngle, this._spherical.phi ) );

		this._spherical.makeSafe();


		// move target to panned location

		if ( this.enableDamping === true ) {

			this.target.addScaledVector( this._panOffset, this.dampingFactor );

		} else {

			this.target.add( this._panOffset );

		}

		// Limit the target distance from the cursor to create a sphere around the center of interest
		this.target.sub( this.cursor );
		this.target.clampLength( this.minTargetRadius, this.maxTargetRadius );
		this.target.add( this.cursor );

		let zoomChanged = false;
		// adjust the camera position based on zoom only if we're not zooming to the cursor or if it's an ortho camera
		// we adjust zoom later in these cases
		if ( this.zoomToCursor && this._performCursorZoom || this.object.isOrthographicCamera ) {

			this._spherical.radius = this._clampDistance( this._spherical.radius );

		} else {

			const prevRadius = this._spherical.radius;
			this._spherical.radius = this._clampDistance( this._spherical.radius * this._scale );
			zoomChanged = prevRadius != this._spherical.radius;

		}

		_v.setFromSpherical( this._spherical );

		// rotate offset back to "camera-up-vector-is-up" space
		_v.applyQuaternion( this._quatInverse );

		position.copy( this.target ).add( _v );

		this.object.lookAt( this.target );

		if ( this.enableDamping === true ) {

			this._sphericalDelta.theta *= ( 1 - this.dampingFactor );
			this._sphericalDelta.phi *= ( 1 - this.dampingFactor );

			this._panOffset.multiplyScalar( 1 - this.dampingFactor );

		} else {

			this._sphericalDelta.set( 0, 0, 0 );

			this._panOffset.set( 0, 0, 0 );

		}

		// adjust camera position
		if ( this.zoomToCursor && this._performCursorZoom ) {

			let newRadius = null;
			if ( this.object.isPerspectiveCamera ) {

				// move the camera down the pointer ray
				// this method avoids floating point error
				const prevRadius = _v.length();
				newRadius = this._clampDistance( prevRadius * this._scale );

				const radiusDelta = prevRadius - newRadius;
				this.object.position.addScaledVector( this._dollyDirection, radiusDelta );
				this.object.updateMatrixWorld();

				zoomChanged = !! radiusDelta;

			} else if ( this.object.isOrthographicCamera ) {

				// adjust the ortho camera position based on zoom changes
				const mouseBefore = new Vector3( this._mouse.x, this._mouse.y, 0 );
				mouseBefore.unproject( this.object );

				const prevZoom = this.object.zoom;
				this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );
				this.object.updateProjectionMatrix();

				zoomChanged = prevZoom !== this.object.zoom;

				const mouseAfter = new Vector3( this._mouse.x, this._mouse.y, 0 );
				mouseAfter.unproject( this.object );

				this.object.position.sub( mouseAfter ).add( mouseBefore );
				this.object.updateMatrixWorld();

				newRadius = _v.length();

			} else {

				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.' );
				this.zoomToCursor = false;

			}

			// handle the placement of the target
			if ( newRadius !== null ) {

				if ( this.screenSpacePanning ) {

					// position the orbit target in front of the new camera position
					this.target.set( 0, 0, -1 )
						.transformDirection( this.object.matrix )
						.multiplyScalar( newRadius )
						.add( this.object.position );

				} else {

					// get the ray and translation plane to compute target
					_ray.origin.copy( this.object.position );
					_ray.direction.set( 0, 0, -1 ).transformDirection( this.object.matrix );

					// if the camera is 20 degrees above the horizon then don't adjust the focus target to avoid
					// extremely large values
					if ( Math.abs( this.object.up.dot( _ray.direction ) ) < _TILT_LIMIT ) {

						this.object.lookAt( this.target );

					} else {

						_plane.setFromNormalAndCoplanarPoint( this.object.up, this.target );
						_ray.intersectPlane( _plane, this.target );

					}

				}

			}

		} else if ( this.object.isOrthographicCamera ) {

			const prevZoom = this.object.zoom;
			this.object.zoom = Math.max( this.minZoom, Math.min( this.maxZoom, this.object.zoom / this._scale ) );

			if ( prevZoom !== this.object.zoom ) {

				this.object.updateProjectionMatrix();
				zoomChanged = true;

			}

		}

		this._scale = 1;
		this._performCursorZoom = false;

		// update condition is:
		// min(camera displacement, camera rotation in radians)^2 > EPS
		// using small-angle approximation cos(x/2) = 1 - x^2 / 8

		if ( zoomChanged ||
			this._lastPosition.distanceToSquared( this.object.position ) > _EPS ||
			8 * ( 1 - this._lastQuaternion.dot( this.object.quaternion ) ) > _EPS ||
			this._lastTargetPosition.distanceToSquared( this.target ) > _EPS ) {

			this.dispatchEvent( _changeEvent );

			this._lastPosition.copy( this.object.position );
			this._lastQuaternion.copy( this.object.quaternion );
			this._lastTargetPosition.copy( this.target );

			return true;

		}

		return false;

	}

	_getAutoRotationAngle( deltaTime ) {

		if ( deltaTime !== null ) {

			return ( _twoPI / 60 * this.autoRotateSpeed ) * deltaTime;

		} else {

			return _twoPI / 60 / 60 * this.autoRotateSpeed;

		}

	}

	_getZoomScale( delta ) {

		const normalizedDelta = Math.abs( delta * 0.01 );
		return Math.pow( 0.95, this.zoomSpeed * normalizedDelta );

	}

	_rotateLeft( angle ) {

		this._sphericalDelta.theta -= angle;

	}

	_rotateUp( angle ) {

		this._sphericalDelta.phi -= angle;

	}

	_panLeft( distance, objectMatrix ) {

		_v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
		_v.multiplyScalar( - distance );

		this._panOffset.add( _v );

	}

	_panUp( distance, objectMatrix ) {

		if ( this.screenSpacePanning === true ) {

			_v.setFromMatrixColumn( objectMatrix, 1 );

		} else {

			_v.setFromMatrixColumn( objectMatrix, 0 );
			_v.crossVectors( this.object.up, _v );

		}

		_v.multiplyScalar( distance );

		this._panOffset.add( _v );

	}

	// deltaX and deltaY are in pixels; right and down are positive
	_pan( deltaX, deltaY ) {

		const element = this.domElement;

		if ( this.object.isPerspectiveCamera ) {

			// perspective
			const position = this.object.position;
			_v.copy( position ).sub( this.target );
			let targetDistance = _v.length();

			// half of the fov is center to top of screen
			targetDistance *= Math.tan( ( this.object.fov / 2 ) * Math.PI / 180.0 );

			// we use only clientHeight here so aspect ratio does not distort speed
			this._panLeft( 2 * deltaX * targetDistance / element.clientHeight, this.object.matrix );
			this._panUp( 2 * deltaY * targetDistance / element.clientHeight, this.object.matrix );

		} else if ( this.object.isOrthographicCamera ) {

			// orthographic
			this._panLeft( deltaX * ( this.object.right - this.object.left ) / this.object.zoom / element.clientWidth, this.object.matrix );
			this._panUp( deltaY * ( this.object.top - this.object.bottom ) / this.object.zoom / element.clientHeight, this.object.matrix );

		} else {

			// camera neither orthographic nor perspective
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
			this.enablePan = false;

		}

	}

	_dollyOut( dollyScale ) {

		if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

			this._scale /= dollyScale;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			this.enableZoom = false;

		}

	}

	_dollyIn( dollyScale ) {

		if ( this.object.isPerspectiveCamera || this.object.isOrthographicCamera ) {

			this._scale *= dollyScale;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			this.enableZoom = false;

		}

	}

	_updateZoomParameters( x, y ) {

		if ( ! this.zoomToCursor ) {

			return;

		}

		this._performCursorZoom = true;

		const rect = this.domElement.getBoundingClientRect();
		const dx = x - rect.left;
		const dy = y - rect.top;
		const w = rect.width;
		const h = rect.height;

		this._mouse.x = ( dx / w ) * 2 - 1;
		this._mouse.y = - ( dy / h ) * 2 + 1;

		this._dollyDirection.set( this._mouse.x, this._mouse.y, 1 ).unproject( this.object ).sub( this.object.position ).normalize();

	}

	_clampDistance( dist ) {

		return Math.max( this.minDistance, Math.min( this.maxDistance, dist ) );

	}

	//
	// event callbacks - update the object state
	//

	_handleMouseDownRotate( event ) {

		this._rotateStart.set( event.clientX, event.clientY );

	}

	_handleMouseDownDolly( event ) {

		this._updateZoomParameters( event.clientX, event.clientX );
		this._dollyStart.set( event.clientX, event.clientY );

	}

	_handleMouseDownPan( event ) {

		this._panStart.set( event.clientX, event.clientY );

	}

	_handleMouseMoveRotate( event ) {

		this._rotateEnd.set( event.clientX, event.clientY );

		this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

		const element = this.domElement;

		this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

		this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

		this._rotateStart.copy( this._rotateEnd );

		this.update();

	}

	_handleMouseMoveDolly( event ) {

		this._dollyEnd.set( event.clientX, event.clientY );

		this._dollyDelta.subVectors( this._dollyEnd, this._dollyStart );

		if ( this._dollyDelta.y > 0 ) {

			this._dollyOut( this._getZoomScale( this._dollyDelta.y ) );

		} else if ( this._dollyDelta.y < 0 ) {

			this._dollyIn( this._getZoomScale( this._dollyDelta.y ) );

		}

		this._dollyStart.copy( this._dollyEnd );

		this.update();

	}

	_handleMouseMovePan( event ) {

		this._panEnd.set( event.clientX, event.clientY );

		this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

		this._pan( this._panDelta.x, this._panDelta.y );

		this._panStart.copy( this._panEnd );

		this.update();

	}

	_handleMouseWheel( event ) {

		this._updateZoomParameters( event.clientX, event.clientY );

		if ( event.deltaY < 0 ) {

			this._dollyIn( this._getZoomScale( event.deltaY ) );

		} else if ( event.deltaY > 0 ) {

			this._dollyOut( this._getZoomScale( event.deltaY ) );

		}

		this.update();

	}

	_handleKeyDown( event ) {

		let needsUpdate = false;

		switch ( event.code ) {

			case this.keys.UP:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateUp( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( 0, this.keyPanSpeed );

					}

				}

				needsUpdate = true;
				break;

			case this.keys.BOTTOM:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateUp( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( 0, - this.keyPanSpeed );

					}

				}

				needsUpdate = true;
				break;

			case this.keys.LEFT:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateLeft( _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( this.keyPanSpeed, 0 );

					}

				}

				needsUpdate = true;
				break;

			case this.keys.RIGHT:

				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

					if ( this.enableRotate ) {

						this._rotateLeft( - _twoPI * this.keyRotateSpeed / this.domElement.clientHeight );

					}

				} else {

					if ( this.enablePan ) {

						this._pan( - this.keyPanSpeed, 0 );

					}

				}

				needsUpdate = true;
				break;

		}

		if ( needsUpdate ) {

			// prevent the browser from scrolling on cursor keys
			event.preventDefault();

			this.update();

		}


	}

	_handleTouchStartRotate( event ) {

		if ( this._pointers.length === 1 ) {

			this._rotateStart.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._rotateStart.set( x, y );

		}

	}

	_handleTouchStartPan( event ) {

		if ( this._pointers.length === 1 ) {

			this._panStart.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._panStart.set( x, y );

		}

	}

	_handleTouchStartDolly( event ) {

		const position = this._getSecondPointerPosition( event );

		const dx = event.pageX - position.x;
		const dy = event.pageY - position.y;

		const distance = Math.sqrt( dx * dx + dy * dy );

		this._dollyStart.set( 0, distance );

	}

	_handleTouchStartDollyPan( event ) {

		if ( this.enableZoom ) this._handleTouchStartDolly( event );

		if ( this.enablePan ) this._handleTouchStartPan( event );

	}

	_handleTouchStartDollyRotate( event ) {

		if ( this.enableZoom ) this._handleTouchStartDolly( event );

		if ( this.enableRotate ) this._handleTouchStartRotate( event );

	}

	_handleTouchMoveRotate( event ) {

		if ( this._pointers.length == 1 ) {

			this._rotateEnd.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._rotateEnd.set( x, y );

		}

		this._rotateDelta.subVectors( this._rotateEnd, this._rotateStart ).multiplyScalar( this.rotateSpeed );

		const element = this.domElement;

		this._rotateLeft( _twoPI * this._rotateDelta.x / element.clientHeight ); // yes, height

		this._rotateUp( _twoPI * this._rotateDelta.y / element.clientHeight );

		this._rotateStart.copy( this._rotateEnd );

	}

	_handleTouchMovePan( event ) {

		if ( this._pointers.length === 1 ) {

			this._panEnd.set( event.pageX, event.pageY );

		} else {

			const position = this._getSecondPointerPosition( event );

			const x = 0.5 * ( event.pageX + position.x );
			const y = 0.5 * ( event.pageY + position.y );

			this._panEnd.set( x, y );

		}

		this._panDelta.subVectors( this._panEnd, this._panStart ).multiplyScalar( this.panSpeed );

		this._pan( this._panDelta.x, this._panDelta.y );

		this._panStart.copy( this._panEnd );

	}

	_handleTouchMoveDolly( event ) {

		const position = this._getSecondPointerPosition( event );

		const dx = event.pageX - position.x;
		const dy = event.pageY - position.y;

		const distance = Math.sqrt( dx * dx + dy * dy );

		this._dollyEnd.set( 0, distance );

		this._dollyDelta.set( 0, Math.pow( this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed ) );

		this._dollyOut( this._dollyDelta.y );

		this._dollyStart.copy( this._dollyEnd );

		const centerX = ( event.pageX + position.x ) * 0.5;
		const centerY = ( event.pageY + position.y ) * 0.5;

		this._updateZoomParameters( centerX, centerY );

	}

	_handleTouchMoveDollyPan( event ) {

		if ( this.enableZoom ) this._handleTouchMoveDolly( event );

		if ( this.enablePan ) this._handleTouchMovePan( event );

	}

	_handleTouchMoveDollyRotate( event ) {

		if ( this.enableZoom ) this._handleTouchMoveDolly( event );

		if ( this.enableRotate ) this._handleTouchMoveRotate( event );

	}

	// pointers

	_addPointer( event ) {

		this._pointers.push( event.pointerId );

	}

	_removePointer( event ) {

		delete this._pointerPositions[ event.pointerId ];

		for ( let i = 0; i < this._pointers.length; i ++ ) {

			if ( this._pointers[ i ] == event.pointerId ) {

				this._pointers.splice( i, 1 );
				return;

			}

		}

	}

	_isTrackingPointer( event ) {

		for ( let i = 0; i < this._pointers.length; i ++ ) {

			if ( this._pointers[ i ] == event.pointerId ) return true;

		}

		return false;

	}

	_trackPointer( event ) {

		let position = this._pointerPositions[ event.pointerId ];

		if ( position === undefined ) {

			position = new Vector2();
			this._pointerPositions[ event.pointerId ] = position;

		}

		position.set( event.pageX, event.pageY );

	}

	_getSecondPointerPosition( event ) {

		const pointerId = ( event.pointerId === this._pointers[ 0 ] ) ? this._pointers[ 1 ] : this._pointers[ 0 ];

		return this._pointerPositions[ pointerId ];

	}

	//

	_customWheelEvent( event ) {

		const mode = event.deltaMode;

		// minimal wheel event altered to meet delta-zoom demand
		const newEvent = {
			clientX: event.clientX,
			clientY: event.clientY,
			deltaY: event.deltaY,
		};

		switch ( mode ) {

			case 1: // LINE_MODE
				newEvent.deltaY *= 16;
				break;

			case 2: // PAGE_MODE
				newEvent.deltaY *= 100;
				break;

		}

		// detect if event was triggered by pinching
		if ( event.ctrlKey && ! this._controlActive ) {

			newEvent.deltaY *= 10;

		}

		return newEvent;

	}

}

function onPointerDown( event ) {

	if ( this.enabled === false ) return;

	if ( this._pointers.length === 0 ) {

		this.domElement.setPointerCapture( event.pointerId );

		this.domElement.addEventListener( 'pointermove', this._onPointerMove );
		this.domElement.addEventListener( 'pointerup', this._onPointerUp );

	}

	//

	if ( this._isTrackingPointer( event ) ) return;

	//

	this._addPointer( event );

	if ( event.pointerType === 'touch' ) {

		this._onTouchStart( event );

	} else {

		this._onMouseDown( event );

	}

}

function onPointerMove( event ) {

	if ( this.enabled === false ) return;

	if ( event.pointerType === 'touch' ) {

		this._onTouchMove( event );

	} else {

		this._onMouseMove( event );

	}

}

function onPointerUp( event ) {

	this._removePointer( event );

	switch ( this._pointers.length ) {

		case 0:

			this.domElement.releasePointerCapture( event.pointerId );

			this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
			this.domElement.removeEventListener( 'pointerup', this._onPointerUp );

			this.dispatchEvent( _endEvent );

			this.state = _STATE.NONE;

			break;

		case 1:

			const pointerId = this._pointers[ 0 ];
			const position = this._pointerPositions[ pointerId ];

			// minimal placeholder event - allows state correction on pointer-up
			this._onTouchStart( { pointerId: pointerId, pageX: position.x, pageY: position.y } );

			break;

	}

}

function onMouseDown( event ) {

	let mouseAction;

	switch ( event.button ) {

		case 0:

			mouseAction = this.mouseButtons.LEFT;
			break;

		case 1:

			mouseAction = this.mouseButtons.MIDDLE;
			break;

		case 2:

			mouseAction = this.mouseButtons.RIGHT;
			break;

		default:

			mouseAction = -1;

	}

	switch ( mouseAction ) {

		case MOUSE.DOLLY:

			if ( this.enableZoom === false ) return;

			this._handleMouseDownDolly( event );

			this.state = _STATE.DOLLY;

			break;

		case MOUSE.ROTATE:

			if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

				if ( this.enablePan === false ) return;

				this._handleMouseDownPan( event );

				this.state = _STATE.PAN;

			} else {

				if ( this.enableRotate === false ) return;

				this._handleMouseDownRotate( event );

				this.state = _STATE.ROTATE;

			}

			break;

		case MOUSE.PAN:

			if ( event.ctrlKey || event.metaKey || event.shiftKey ) {

				if ( this.enableRotate === false ) return;

				this._handleMouseDownRotate( event );

				this.state = _STATE.ROTATE;

			} else {

				if ( this.enablePan === false ) return;

				this._handleMouseDownPan( event );

				this.state = _STATE.PAN;

			}

			break;

		default:

			this.state = _STATE.NONE;

	}

	if ( this.state !== _STATE.NONE ) {

		this.dispatchEvent( _startEvent );

	}

}

function onMouseMove( event ) {

	switch ( this.state ) {

		case _STATE.ROTATE:

			if ( this.enableRotate === false ) return;

			this._handleMouseMoveRotate( event );

			break;

		case _STATE.DOLLY:

			if ( this.enableZoom === false ) return;

			this._handleMouseMoveDolly( event );

			break;

		case _STATE.PAN:

			if ( this.enablePan === false ) return;

			this._handleMouseMovePan( event );

			break;

	}

}

function onMouseWheel( event ) {

	if ( this.enabled === false || this.enableZoom === false || this.state !== _STATE.NONE ) return;

	event.preventDefault();

	this.dispatchEvent( _startEvent );

	this._handleMouseWheel( this._customWheelEvent( event ) );

	this.dispatchEvent( _endEvent );

}

function onKeyDown( event ) {

	if ( this.enabled === false ) return;

	this._handleKeyDown( event );

}

function onTouchStart( event ) {

	this._trackPointer( event );

	switch ( this._pointers.length ) {

		case 1:

			switch ( this.touches.ONE ) {

				case TOUCH.ROTATE:

					if ( this.enableRotate === false ) return;

					this._handleTouchStartRotate( event );

					this.state = _STATE.TOUCH_ROTATE;

					break;

				case TOUCH.PAN:

					if ( this.enablePan === false ) return;

					this._handleTouchStartPan( event );

					this.state = _STATE.TOUCH_PAN;

					break;

				default:

					this.state = _STATE.NONE;

			}

			break;

		case 2:

			switch ( this.touches.TWO ) {

				case TOUCH.DOLLY_PAN:

					if ( this.enableZoom === false && this.enablePan === false ) return;

					this._handleTouchStartDollyPan( event );

					this.state = _STATE.TOUCH_DOLLY_PAN;

					break;

				case TOUCH.DOLLY_ROTATE:

					if ( this.enableZoom === false && this.enableRotate === false ) return;

					this._handleTouchStartDollyRotate( event );

					this.state = _STATE.TOUCH_DOLLY_ROTATE;

					break;

				default:

					this.state = _STATE.NONE;

			}

			break;

		default:

			this.state = _STATE.NONE;

	}

	if ( this.state !== _STATE.NONE ) {

		this.dispatchEvent( _startEvent );

	}

}

function onTouchMove( event ) {

	this._trackPointer( event );

	switch ( this.state ) {

		case _STATE.TOUCH_ROTATE:

			if ( this.enableRotate === false ) return;

			this._handleTouchMoveRotate( event );

			this.update();

			break;

		case _STATE.TOUCH_PAN:

			if ( this.enablePan === false ) return;

			this._handleTouchMovePan( event );

			this.update();

			break;

		case _STATE.TOUCH_DOLLY_PAN:

			if ( this.enableZoom === false && this.enablePan === false ) return;

			this._handleTouchMoveDollyPan( event );

			this.update();

			break;

		case _STATE.TOUCH_DOLLY_ROTATE:

			if ( this.enableZoom === false && this.enableRotate === false ) return;

			this._handleTouchMoveDollyRotate( event );

			this.update();

			break;

		default:

			this.state = _STATE.NONE;

	}

}

function onContextMenu( event ) {

	if ( this.enabled === false ) return;

	event.preventDefault();

}

function interceptControlDown( event ) {

	if ( event.key === 'Control' ) {

		this._controlActive = true;

		const document = this.domElement.getRootNode(); // offscreen canvas compatibility

		document.addEventListener( 'keyup', this._interceptControlUp, { passive: true, capture: true } );

	}

}

function interceptControlUp( event ) {

	if ( event.key === 'Control' ) {

		this._controlActive = false;

		const document = this.domElement.getRootNode(); // offscreen canvas compatibility

		document.removeEventListener( 'keyup', this._interceptControlUp, { passive: true, capture: true } );

	}

}

function disposeGroup(group) {
    group.traverse((o) => {
        const mesh = o;
        if (mesh instanceof InstancedMesh)
            mesh.dispose();
        if (mesh.geometry)
            mesh.geometry.dispose();
        if (mesh.material) {
            const list = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];
            list.forEach((x) => x.dispose());
        }
    });
    group.clear();
}
function StaticPlot({ model }) {
    const [xmin, xmax, ymin, ymax] = model.range, w = 700, h = 400;
    const xy = (p) => `${((p[0] - xmin) / (xmax - xmin)) * w},${h - ((p[1] - ymin) / (ymax - ymin)) * h}`;
    return (jsxRuntimeExports.jsxs("svg", { viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": model.description, className: "fallback-plot", children: [model.surfaces.map((s, i) => (jsxRuntimeExports.jsx("polygon", { points: s.points.map(xy).join(" "), fill: s.color, opacity: s.opacity }, "p" + i))), jsxRuntimeExports.jsx("path", { d: `M${xy([xmin, 0, 0])} L${xy([xmax, 0, 0])} M${xy([0, ymin, 0])} L${xy([0, ymax, 0])}`, stroke: "#a8a29e", strokeWidth: "1" }), model.lines.map((l, i) => (jsxRuntimeExports.jsx("polyline", { points: l.points.map(xy).join(" "), stroke: l.color, fill: "none", opacity: l.opacity ?? 1, strokeWidth: "3", strokeDasharray: l.dashed ? "5 5" : undefined }, i))), model.dots.map((d, i) => {
                const [x, y] = xy(d.at).split(",");
                return (jsxRuntimeExports.jsx("circle", { cx: x, cy: y, r: "5", fill: d.open ? "var(--surface)" : d.color, stroke: d.color, strokeWidth: "2" }, i));
            })] }));
}
function MathScene({ id, parameters, step, resetKey = 0, compact = false, }) {
    const host = reactExports.useRef(null), engine = reactExports.useRef(null);
    const progress = reactExports.useRef(step), lastId = reactExports.useRef(id), lastStep = reactExports.useRef(step), frame = reactExports.useRef(0), [failed, setFailed] = reactExports.useState(false), [dark, setDark] = reactExports.useState(false);
    const finalModel = makeModel(id, parameters, step), threeD = finalModel.threeD;
    const bounds = reactExports.useMemo(() => questionBounds(id), [id]);
    reactExports.useEffect(() => {
        const update = () => setDark(getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim() === "#0c0a09");
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        const media = matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", update);
        return () => {
            observer.disconnect();
            media.removeEventListener("change", update);
        };
    }, []);
    reactExports.useEffect(() => {
        if (!host.current)
            return;
        let renderer;
        try {
            renderer = new WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: "low-power",
            });
            renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        }
        catch {
            setFailed(true);
            return;
        }
        setFailed(false);
        const scene = new Scene(), camera = new OrthographicCamera(-5, 5, 4, -4, 0.01, Math.max(100, (bounds?.radius ?? 5) * 20)), group = new Group(), textures = new Map();
        scene.add(group);
        renderer.domElement.setAttribute("role", "img");
        renderer.domElement.setAttribute("aria-label", threeD
            ? "풀이 단계에 따라 변하는 공간 도형. 드래그로 회전합니다."
            : "풀이 단계에 따라 변하는 좌표평면 그래프. 아래 조작부로 조건을 바꿀 수 있습니다.");
        host.current.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableRotate = threeD;
        controls.enablePan = true;
        controls.enableZoom = true;
        if (!threeD) {
            controls.mouseButtons.LEFT = MOUSE.PAN;
            controls.touches.ONE = TOUCH.PAN;
            controls.touches.TWO = TOUCH.DOLLY_PAN;
        }
        controls.minZoom = 0.65;
        controls.maxZoom = 8;
        controls.target.set(...(threeD && bounds
            ? bounds.center
            : [threeD ? 1.6 : 0, threeD ? 1 : 0, 0]));
        const position = () => {
            camera.up.set(0, threeD ? 0 : 1, threeD ? 1 : 0);
            camera.position.set(threeD ? 7 : 0, threeD ? -9 : 0, threeD ? 8 : 20);
            if (threeD && bounds)
                camera.position
                    .copy(controls.target)
                    .add(new Vector3(7, -9, 8)
                    .normalize()
                    .multiplyScalar(bounds.radius * 3));
            camera.lookAt(controls.target);
            camera.zoom = 1;
            camera.updateProjectionMatrix();
            controls.update();
        };
        position();
        let current;
        const render = () => renderer.render(scene, camera);
        const fit = () => {
            if (!host.current)
                return;
            const width = host.current.clientWidth, height = host.current.clientHeight || 400;
            renderer.setSize(width, height, false);
            const aspect = width / height;
            if (threeD) {
                const half = bounds
                    ? (bounds.radius * 1.15) / Math.min(1, aspect)
                    : 5.3;
                camera.left = -half * aspect;
                camera.right = half * aspect;
                camera.top = half;
                camera.bottom = -half;
            }
            else if (current) {
                const [xmin, xmax, ymin, ymax] = current.range, cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
                let dx = (xmax - xmin) / 2, dy = (ymax - ymin) / 2;
                if (current.equalAspect || ["conic", "vector"].includes(id)) {
                    if (dx / dy < aspect)
                        dx = dy * aspect;
                    else
                        dy = dx / aspect;
                }
                camera.left = cx - dx;
                camera.right = cx + dx;
                camera.top = cy + dy;
                camera.bottom = cy - dy;
            }
            camera.updateProjectionMatrix();
            render();
        };
        const horizontalScale = () => {
            if (threeD ||
                !current ||
                !host.current ||
                current.equalAspect ||
                ["conic", "vector"].includes(id))
                return 1;
            return ((current.range[1] - current.range[0]) /
                (current.range[3] - current.range[2]) /
                (host.current.clientWidth / host.current.clientHeight));
        };
        const stroke = (points, color, opacity = 1, dashed = false, width = 0.022) => {
            if (points.length < 2 || opacity < 0.01)
                return;
            const geometry = new BufferGeometry().setFromPoints(points.map((p) => new Vector3(...p)));
            const material = dashed
                ? new LineDashedMaterial({
                    color,
                    transparent: true,
                    opacity,
                    dashSize: 0.1,
                    gapSize: 0.07,
                })
                : new LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity,
                    linewidth: width,
                });
            const object = new Line(geometry, material);
            object.computeLineDistances();
            group.add(object);
        };
        const label = (text, p, scale = 0.6) => {
            const key = text + dark;
            let texture = textures.get(key);
            if (!texture) {
                const c = document.createElement("canvas");
                c.width = 384;
                c.height = 80;
                const ctx = c.getContext("2d");
                ctx.font = '30px "Pretendard Variable", sans-serif';
                ctx.fillStyle = dark ? "#e7e5e4" : "#57534e";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillText(text, 192, 40, 365);
                texture = new CanvasTexture(c);
                textures.set(key, texture);
            }
            const sprite = new Sprite(new SpriteMaterial({
                map: texture,
                depthTest: false,
                transparent: true,
            }));
            sprite.position.set(...p);
            sprite.scale.set(scale * 4.8 * horizontalScale(), scale, 1);
            group.add(sprite);
        };
        const draw = (model) => {
            current = model;
            disposeGroup(group);
            const [xmin, xmax, ymin, ymax] = model.range;
            const grid = dark ? "#3b3530" : "#e7e5e4", ink = dark ? "#a8a29e" : "#a8a29e";
            if (!threeD) {
                const tickSize = (span) => {
                    const power = 10 ** Math.floor(Math.log10(span / 8)), m = span / 8 / power;
                    return power * (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10);
                };
                const dx = tickSize(xmax - xmin), dy = tickSize(ymax - ymin);
                const labelUnit = (ymax - ymin) / 8;
                for (let x = Math.ceil(xmin / dx) * dx; x <= xmax + dx * 0.01; x += dx) {
                    stroke([
                        [x, ymin, 0],
                        [x, ymax, 0],
                    ], grid, 0.65);
                    if (Math.abs(x) > 0.01 && !(model.symbolicX && x > 0))
                        label(Number(x.toPrecision(5)).toString(), [
                            x,
                            Math.max(ymin + 0.35 * labelUnit, Math.min(ymax - 0.35 * labelUnit, -0.3 * labelUnit)),
                            0.01,
                        ], 0.48 * labelUnit);
                }
                for (let y = Math.ceil(ymin / dy) * dy; y <= ymax + dy * 0.01; y += dy) {
                    stroke([
                        [xmin, y, 0],
                        [xmax, y, 0],
                    ], grid, 0.65);
                    if (Math.abs(y) > 0.01)
                        label(Number(y.toPrecision(5)).toString(), [
                            Math.max(xmin + (xmax - xmin) * 0.04, Math.min(xmax - (xmax - xmin) * 0.04, -0.35 * labelUnit * horizontalScale())),
                            y,
                            0.01,
                        ], 0.48 * labelUnit);
                }
                stroke([
                    [xmin, 0, 0.01],
                    [xmax, 0, 0.01],
                ], ink);
                stroke([
                    [0, ymin, 0.01],
                    [0, ymax, 0.01],
                ], ink);
                label(id === "integral" && progress.current >= 3 ? "u" : "x", [xmax - 0.08 * (xmax - xmin), -0.55 * labelUnit, 0.01], 0.6 * labelUnit);
                if (model.axisLabel)
                    label(model.axisLabel, [xmin + (xmax - xmin) * 0.15, ymax - 0.3 * labelUnit, 0.01], 0.55 * labelUnit);
            }
            else {
                for (let x = -5; x <= 5; x++)
                    stroke([
                        [x, -1, 0],
                        [x, 4, 0],
                    ], grid, 0.6);
                for (let y = -1; y <= 4; y++)
                    stroke([
                        [-5, y, 0],
                        [5, y, 0],
                    ], grid, 0.6);
                stroke([
                    [-5, 0, 0],
                    [5, 0, 0],
                ], ink);
                stroke([
                    [0, -1, 0],
                    [0, 4, 0],
                ], ink);
                stroke([
                    [0, 0, 0],
                    [0, 0, 3.5],
                ], ink);
                label("x", [5.15, 0, 0]);
                label("y", [0, 4.15, 0]);
                label("z", [0, 0, 3.65]);
            }
            model.surfaces.forEach((s) => {
                if (s.points.length < 3)
                    return;
                const vertices = [];
                if (s.triangulation === "strip-to-axis") {
                    for (let i = 1; i < s.points.length - 2; i++) {
                        const a = s.points[i], b = s.points[i + 1];
                        vertices.push(a[0], 0, a[2], ...a, ...b, a[0], 0, a[2], ...b, b[0], 0, b[2]);
                    }
                }
                else {
                    const origin = new Vector3(...s.points[0]);
                    const u = new Vector3(), normal = new Vector3();
                    for (let i = 1; i < s.points.length; i++) {
                        u.set(...s.points[i]).sub(origin);
                        if (u.lengthSq() > 1e-14)
                            break;
                    }
                    for (let i = 2; i < s.points.length; i++) {
                        normal.crossVectors(u, new Vector3(...s.points[i]).sub(origin));
                        if (normal.lengthSq() > 1e-14)
                            break;
                    }
                    if (normal.lengthSq() > 1e-14) {
                        u.normalize();
                        normal.normalize();
                        const v = new Vector3().crossVectors(normal, u);
                        const contour = s.points.map((pt) => {
                            const d = new Vector3(...pt).sub(origin);
                            return new Vector2(d.dot(u), d.dot(v));
                        });
                        for (const face of ShapeUtils.triangulateShape(contour, []))
                            for (const index of face)
                                vertices.push(...s.points[index]);
                    }
                }
                const geom = new BufferGeometry();
                geom.setAttribute("position", new Float32BufferAttribute(vertices, 3));
                const mesh = new Mesh(geom, new MeshBasicMaterial({
                    color: s.color,
                    transparent: true,
                    opacity: s.opacity,
                    side: DoubleSide,
                    depthWrite: false,
                }));
                mesh.renderOrder = -1;
                group.add(mesh);
            });
            model.lines.forEach((l) => stroke(l.points, l.color, l.opacity ?? 1, l.dashed, l.width));
            const aspect = host.current
                ? host.current.clientWidth / (host.current.clientHeight || 400)
                : 1.75;
            const sameScale = model.equalAspect || ["conic", "vector"].includes(id);
            const unit = threeD
                ? bounds
                    ? bounds.radius / 5
                    : 1
                : (sameScale
                    ? Math.max(ymax - ymin, (xmax - xmin) / aspect)
                    : ymax - ymin) / 7;
            const closedGroups = new Map();
            for (const d of model.dots) {
                if (d.open)
                    continue;
                const key = `${d.color}/${d.opacity ?? 1}`;
                const list = closedGroups.get(key) || [];
                list.push(d);
                closedGroups.set(key, list);
            }
            for (const ds of closedGroups.values()) {
                const geometry = threeD
                    ? new SphereGeometry(1, 10, 6)
                    : new CircleGeometry(1, 16);
                const material = new MeshBasicMaterial({
                    color: ds[0].color,
                    side: DoubleSide,
                    depthTest: false,
                    transparent: true,
                    opacity: ds[0].opacity ?? 1,
                });
                const mesh = new InstancedMesh(geometry, material, ds.length), matrix = new Matrix4(), quaternion = new Quaternion();
                ds.forEach((d, i) => {
                    const r = (d.size ?? 0.065) * unit;
                    matrix.compose(new Vector3(d.at[0], d.at[1], d.at[2] + 0.02), quaternion, new Vector3(r * horizontalScale(), r, r));
                    mesh.setMatrixAt(i, matrix);
                });
                mesh.instanceMatrix.needsUpdate = true;
                mesh.renderOrder = 3;
                group.add(mesh);
            }
            model.dots.forEach((d) => {
                if (!d.open) {
                    if (d.label && (d.opacity ?? 1) > 0.5)
                        label(d.label, [d.at[0], d.at[1] + 0.34 * unit, d.at[2] + 0.06], 0.5 * unit);
                    return;
                }
                const radius = (d.size ?? 0.065) * unit;
                const geom = d.open
                    ? new RingGeometry(radius * 0.65, radius, 28)
                    : threeD
                        ? new SphereGeometry(radius, 12, 8)
                        : new CircleGeometry(radius, 20);
                const mat = new MeshBasicMaterial({
                    color: d.color,
                    side: DoubleSide,
                    depthTest: false,
                    transparent: true,
                    opacity: d.opacity ?? 1,
                });
                const mesh = new Mesh(geom, mat);
                mesh.position.set(...d.at);
                mesh.position.z += 0.02;
                mesh.scale.x = horizontalScale();
                mesh.renderOrder = 3;
                group.add(mesh);
                if (d.open) {
                    const hole = new Mesh(new CircleGeometry(radius * 0.65, 24), new MeshBasicMaterial({
                        color: dark ? "#1c1917" : "#ffffff",
                        depthTest: false,
                        transparent: true,
                        opacity: d.opacity ?? 1,
                    }));
                    hole.position.copy(mesh.position);
                    hole.scale.x = horizontalScale();
                    hole.renderOrder = 2;
                    group.add(hole);
                }
                if (d.label && (d.opacity ?? 1) > 0.5)
                    label(d.label, [d.at[0], d.at[1] + 0.34 * unit, d.at[2] + 0.06], 0.5 * unit);
            });
            fit();
            render();
        };
        controls.addEventListener("change", render);
        const observer = new ResizeObserver(fit);
        observer.observe(host.current);
        engine.current = {
            renderer,
            scene,
            camera,
            controls,
            group,
            textures,
            draw,
            fit,
        };
        const loss = (e) => {
            e.preventDefault();
            setFailed(true);
        };
        renderer.domElement.addEventListener("webglcontextlost", loss);
        return () => {
            cancelAnimationFrame(frame.current);
            observer.disconnect();
            controls.dispose();
            disposeGroup(group);
            textures.forEach((t) => t.dispose());
            renderer.domElement.removeEventListener("webglcontextlost", loss);
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
            engine.current = null;
        };
    }, [threeD, dark, resetKey]);
    reactExports.useEffect(() => {
        const api = engine.current;
        if (!api)
            return;
        cancelAnimationFrame(frame.current);
        if (lastId.current !== id) {
            progress.current = step;
            lastId.current = id;
        }
        const from = progress.current, to = step, start = performance.now(), duration = matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 750;
        const cameraStart = api.camera.position.clone();
        const topView = (id === "projection" && step === 3) || (id === "incircle" && step === 5);
        const cameraTarget = bounds
            ? new Vector3(...bounds.center).add(new Vector3(7, -9, 8)
                .normalize()
                .multiplyScalar(bounds.radius * 3))
            : topView
                ? new Vector3(1.6, -2, 14)
                : id === "incircle" && step === 3
                    ? new Vector3(12, -10, 5)
                    : new Vector3(7, -9, 8);
        const changeView = threeD && lastStep.current !== step;
        lastStep.current = step;
        const tick = (now) => {
            const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration), smooth = t * t * (3 - 2 * t);
            progress.current = mix(from, to, smooth);
            if (changeView) {
                api.camera.position.lerpVectors(cameraStart, cameraTarget, smooth);
                api.camera.lookAt(api.controls.target);
            }
            api.draw(makeModel(id, parameters, progress.current));
            if (t < 1)
                frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [id, parameters, step, threeD, dark, resetKey]);
    return (jsxRuntimeExports.jsxs("div", { className: `math-scene ${compact ? "compact" : ""}`, children: [jsxRuntimeExports.jsx("div", { ref: host, className: "canvas-host" }), failed && (jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [jsxRuntimeExports.jsx(StaticPlot, { model: finalModel }), jsxRuntimeExports.jsx("div", { className: "fallback-notice", role: "status", children: "WebGL\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC5B4 \uD3C9\uBA74 \uD22C\uC601\uC73C\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC218\uC2DD\uACFC \uAC12\uC740 \uADF8\uB300\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." })] })), jsxRuntimeExports.jsx("span", { className: "scene-hint", children: threeD
                    ? "드래그 · 회전 / 스크롤 · 확대"
                    : "드래그 · 이동 / 스크롤 · 확대" }), jsxRuntimeExports.jsx("p", { className: "sr-only", children: finalModel.description })] }));
}

export { MathScene as default };
