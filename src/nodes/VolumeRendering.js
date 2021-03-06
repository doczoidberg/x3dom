/*
 * MEDX3DOM JavaScript Library
 * http://medx3dom.org
 *
 * (C)2011 Vicomtech Research Center,
 *         Donostia - San Sebastian
 * Dual licensed under the MIT and GPL.
 *
 * Based on code originally provided by
 * http://www.x3dom.org
 */

 /**
  * http://igraphics.com/Standards/ISO_IEC_19775_1_2_PDAM1_Candidate_2011_05_12/Part01/components/volume.html
  */

/* ### X3DVolumeDataNode ### */
x3dom.registerNodeType(
    "X3DVolumeDataNode",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DShapeNode,   // changed inheritance!
        function (ctx) {
            x3dom.nodeTypes.X3DVolumeDataNode.superClass.call(this, ctx);

            this.addField_SFVec3f(ctx, 'dimensions', 1, 1, 1);
            this.addField_SFNode('voxels', x3dom.nodeTypes.Texture);
            //this.addField_MFNode('voxels', x3dom.nodeTypes.X3DTexture3DNode);
            //this.addField_SFBool(ctx, 'swapped', false);
            //this.addField_SFVec3f(ctx, 'sliceThickness', 1, 1, 1);

            //Neccesary for counting the textures which are added on each style, number of textures can be variable
            this._textureID = 0;

            x3dom.debug.logWarning('VolumeRendering component NYI!!!');
        },
        {
            getTextureSize: function(texture) {
                var size = { w: 0, h: 0, valid: false };
                var texBag = this._webgl ? this._webgl.texture : null;
                var t, n = (texture && texBag) ? texBag.length : 0;

                for (t=0; t<n; t++) {
                    if (texture == texBag[t].node && texBag[t].texture) {
                        size.w = texBag[t].texture.width;
                        size.h = texBag[t].texture.height;
                        if (size.w && size.h) {
                            size.valid = true;
                        }
                        break;
                    }
                }

                return size;
            }
        }
    )
);

/* ### X3DVolumeRenderStyleNode ### */
x3dom.registerNodeType(
    "X3DVolumeRenderStyleNode",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DNode,
        function (ctx) {
            x3dom.nodeTypes.X3DVolumeRenderStyleNode.superClass.call(this, ctx);

            this.addField_SFBool(ctx, 'enabled', true);

            this.preamble = "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
                            "  precision highp float;\n" +
                            "#else\n" +
                            "  precision mediump float;\n" +
                            "#endif\n\n";
        },
        {
            vertexShaderText: function(){
                var shader = 
                "attribute vec3 position;\n"+
                "attribute vec3 color;\n"+
                "uniform mat4 modelViewProjectionMatrix;\n"+
                "varying vec3 vertexColor;\n"+
                "varying vec4 vertexPosition;\n";
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    shader += "uniform mat4 modelViewMatrix;\n"+
                    "varying vec4 position_eye;\n";
                }
                shader += "\n" +
                "void main()\n"+
                "{\n"+
                "  vertexColor = color;\n"+
                "  vertexPosition = modelViewProjectionMatrix * vec4(position, 1.0);\n";
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                   shader += "  position_eye = modelViewMatrix * vec4(position, 1.0);\n";
                }
                shader += 
                "  gl_Position = vertexPosition;\n"+
                "}";
                return shader;
            },

            defaultUniformsShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var uniformsText = 
                "uniform sampler2D uBackCoord;\n"+
                "uniform sampler2D uVolData;\n"+
                "varying vec3 vertexColor;\n"+
                "varying vec4 vertexPosition;\n"+
                "const float Steps = 60.0;\n"+
                "const float numberOfSlices = "+ numberOfSlices.toPrecision(5)+";\n"+
                "const float slicesOverX = " + slicesOverX.toPrecision(5) +";\n"+
                "const float slicesOverY = " + slicesOverY.toPrecision(5) +";\n";
                return uniformsText;
            },

            texture3DFunctionShaderText: "vec4 cTexture3D(sampler2D vol, vec3 volpos, float nS, float nX, float nY)\n"+
                "{\n"+
                "  float s1,s2;\n"+
                "  float dx1,dy1;\n"+
                "  float dx2,dy2;\n"+
                "  vec2 texpos1,texpos2;\n"+
                "  s1 = floor(volpos.z*nS);\n"+
                "  s2 = s1+1.0;\n"+
                "  dx1 = fract(s1/nX);\n"+
                "  dy1 = floor(s1/nY)/nY;\n"+
                "  dx2 = fract(s2/nX);\n"+
                "  dy2 = floor(s2/nY)/nY;\n"+
                "  texpos1.x = dx1+(volpos.x/nX);\n"+
                "  texpos1.y = dy1+(volpos.y/nY);\n"+
                "  texpos2.x = dx2+(volpos.x/nX);\n"+
                "  texpos2.y = dy2+(volpos.y/nY);\n"+
                "  return mix( texture2D(vol,texpos1), texture2D(vol,texpos2), (volpos.z*nS)-s1);\n"+
                "}\n"+
                "\n",

            lightEquationShaderText: function(){
                return "void lighting(in float lType, in vec3 lLocation, in vec3 lDirection, in vec3 lColor, in vec3 lAttenuation, " + 
                "in float lRadius, in float lIntensity, in float lAmbientIntensity, in float lBeamWidth, " +
                "in float lCutOffAngle, in vec3 N, in vec3 V, inout vec3 ambient, inout vec3 diffuse, " +
                "inout vec3 specular)\n" +
                "{\n" +
                "   vec3 L;\n" +
                "   float spot = 1.0, attentuation = 0.0;\n" +
                "   if(lType == 0.0) {\n" +
                "       L = -normalize(lDirection);\n" +
                "       V = normalize(V);\n" +
                "       attentuation = 1.0;\n" +
                "   } else{\n" +
                "       L = (lLocation - (-V));\n" +
                "       float d = length(L);\n" +
                "       L = normalize(L);\n" +
                "       V = normalize(V);\n" +
                "       if(lRadius == 0.0 || d <= lRadius) {\n" +
                "           attentuation = 1.0 / max(lAttenuation.x + lAttenuation.y * d + lAttenuation.z * (d * d), 1.0);\n" +
                "       }\n" +
                "       if(lType == 2.0) {\n" +
                "           float spotAngle = acos(max(0.0, dot(-L, normalize(lDirection))));\n" +
                "           if(spotAngle >= lCutOffAngle) spot = 0.0;\n" +
                "           else if(spotAngle <= lBeamWidth) spot = 1.0;\n" +
                "           else spot = (spotAngle - lCutOffAngle ) / (lBeamWidth - lCutOffAngle);\n" +
                "       }\n" +
                "   }\n" +
                "   vec3  H = normalize( L + V );\n" +
                "   float NdotL = max(0.0, dot(L, N));\n" +
                "   float NdotH = max(0.0, dot(H, N));\n" +   
                "   float ambientFactor  = lAmbientIntensity;\n" +
                "   float diffuseFactor  = lIntensity * NdotL;\n" +
                "   float specularFactor = lIntensity * pow(NdotH,128.0);\n" +
                "   ambient  += lColor * ambientFactor * attentuation * spot;\n" +
                "   diffuse  += lColor * diffuseFactor * attentuation * spot;\n" +
                "   specular += lColor * specularFactor * attentuation * spot;\n" +  
                "}\n"+
                "\n"
            },

            normalFunctionShaderText: function(){
                return "vec4 getNormalFromTexture(sampler2D sampler, vec3 pos, float nS, float nX, float nY) {\n"+
                "   vec4 n = (2.0*cTexture3D(sampler, pos, nS, nX, nY)-1.0);\n"+
                "   n.a = length(n.xyz);\n"+
                "   n.xyz = normalize(n.xyz);\n"+
                "   return n;\n"+
                "}\n"+
                "\n"+
                "vec4 getNormalOnTheFly(sampler2D sampler, vec3 voxPos, float nS, float nX, float nY){\n"+
                "   float v0 = cTexture3D(sampler, voxPos + vec3(offset.x, 0, 0), nS, nX, nY).r;\n"+
                "   float v1 = cTexture3D(sampler, voxPos - vec3(offset.x, 0, 0), nS, nX, nY).r;\n"+
                "   float v2 = cTexture3D(sampler, voxPos + vec3(0, offset.y, 0), nS, nX, nY).r;\n"+
                "   float v3 = cTexture3D(sampler, voxPos - vec3(0, offset.y, 0), nS, nX, nY).r;\n"+
                "   float v4 = cTexture3D(sampler, voxPos + vec3(0, 0, offset.z), nS, nX, nY).r;\n"+
                "   float v5 = cTexture3D(sampler, voxPos - vec3(0, 0, offset.z), nS, nX, nY).r;\n"+
                "   vec3 grad = vec3((v0-v1)/2.0, (v2-v3)/2.0, (v4-v5)/2.0);\n"+
                "   return vec4(normalize(grad), length(grad));\n"+
                "}\n"+
                "\n";
            },    

            //Takes an array as an argument which contains the calls that will be made inside the main loop
            defaultLoopFragmentShaderText: function(inlineShaderText, inlineLightAssigment, initializeValues){
                initializeValues = typeof initializeValues !== 'undefined' ? initializeValues : ""; //default value, empty string
                var shaderLoop = "void main()\n"+
                "{\n"+
                "  vec2 texC = vertexPosition.xy/vertexPosition.w;\n"+
                "  texC = 0.5*texC + 0.5;\n"+
                "  vec4 backColor = texture2D(uBackCoord,texC);\n"+
                "  vec3 dir = backColor.rgb - vertexColor.rgb;\n"+
                "  vec3 pos = vertexColor;\n"+
                "  vec3 cam_pos = vec3(modelViewMatrixInverse[3][0], modelViewMatrixInverse[3][1], modelViewMatrixInverse[3][2]);\n"+
                "  vec4 accum  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                "  vec4 sample = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                "  vec4 value  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                "  float cont = 0.0;\n"+
                "  vec3 step = dir/Steps;\n";
                //Light init values
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    shaderLoop +=
                    "  vec3 ambient = vec3(0.0, 0.0, 0.0);\n"+
                    "  vec3 diffuse = vec3(0.0, 0.0, 0.0);\n"+
                    "  vec3 specular = vec3(0.0, 0.0, 0.0);\n"+
                    "  vec4 step_eye = modelViewMatrix * vec4(step, 0.0);\n"+
                    "  vec4 positionE = position_eye;\n"+
                    "  float lightFactor = 1.0;\n"; 
                }else{
                    shaderLoop += "  float lightFactor = 1.2;\n";
                }
                shaderLoop += initializeValues+
                "  float opacityFactor = 10.0;\n"+
                "  for(float i = 0.0; i < Steps; i+=1.0)\n"+
                "  {\n"+
                "    value = cTexture3D(uVolData, pos, numberOfSlices, slicesOverX, slicesOverY);\n"+
                "    value = vec4(value.rgb,(0.299*value.r)+(0.587*value.g)+(0.114*value.b));\n";
                if(this._cf.surfaceNormals.node){
                    shaderLoop += "    vec4 gradEye = getNormalFromTexture(uSurfaceNormals, pos, numberOfSlices, slicesOverX, slicesOverY);\n";
                }else{
                    shaderLoop += "    vec4 gradEye = getNormalOnTheFly(uVolData, pos, numberOfSlices, slicesOverX, slicesOverY);\n";
                }
                shaderLoop += "    vec4 grad = vec4((modelViewMatrixInverse * vec4(gradEye.xyz, 0.0)).xyz, gradEye.a);\n";
                for(var l=0; l<x3dom.nodeTypes.X3DLightNode.lightID; l++) {
                    shaderLoop += "    lighting(light"+l+"_Type, " +
                    "light"+l+"_Location, " +
                    "light"+l+"_Direction, " +
                    "light"+l+"_Color, " + 
                    "light"+l+"_Attenuation, " +
                    "light"+l+"_Radius, " +
                    "light"+l+"_Intensity, " + 
                    "light"+l+"_AmbientIntensity, " +
                    "light"+l+"_BeamWidth, " +
                    "light"+l+"_CutOffAngle, " +
                    "gradEye.xyz, -positionE.xyz, ambient, diffuse, specular);\n";
                }
                shaderLoop += inlineShaderText;
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    shaderLoop += inlineLightAssigment;
                }
                shaderLoop +=
                "    //Process the volume sample\n"+
                "    sample.a = value.a * opacityFactor * (1.0/Steps);\n"+
                "    sample.rgb = value.rgb * sample.a * lightFactor ;\n"+
                "    accum.rgb += (1.0 - accum.a) * sample.rgb;\n"+
                "    accum.a += (1.0 - accum.a) * sample.a;\n"+
                "    //advance the current position\n"+
                "    pos.xyz += step;\n";
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    shaderLoop +="    positionE += step_eye;\n";
                }
                shaderLoop +=
                "    //break if the position is greater than <1, 1, 1>\n"+
                "    if(pos.x > 1.0 || pos.y > 1.0 || pos.z > 1.0 || accum.a>=1.0)\n"+
                "      break;\n"+
                "  }\n"+
                "   gl_FragColor = accum;\n"+
                "}";
                return shaderLoop;
            }
        }
    )
);

/* ### X3DComposableVolumeRenderStyleNode ### */
x3dom.registerNodeType(
    "X3DComposableVolumeRenderStyleNode",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode.superClass.call(this, ctx);

            this.addField_SFNode('surfaceNormals', x3dom.nodeTypes.X3DTexture3DNode);
        },
        {
            defaultUniformsShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
               var uniformsText = 
                "uniform sampler2D uBackCoord;\n"+
                "uniform sampler2D uVolData;\n"+
                "uniform vec3 offset;\n"+
                "uniform mat4 modelViewMatrix;\n"+
                "uniform mat4 modelViewMatrixInverse;\n"+
                "uniform sampler2D uSurfaceNormals;\n"+ //Necessary for composed style, even it is not used in others
                "varying vec3 vertexColor;\n"+
                "varying vec4 vertexPosition;\n";
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    uniformsText += "varying vec4 position_eye;\n";
                }
                uniformsText +=
                "const float Steps = 60.0;\n"+
                "const float numberOfSlices = "+ numberOfSlices.toPrecision(5)+";\n"+
                "const float slicesOverX = " + slicesOverX.toPrecision(5) +";\n"+
                "const float slicesOverY = " + slicesOverY.toPrecision(5) +";\n";
                //LIGHTS
                var n_lights = x3dom.nodeTypes.X3DLightNode.lightID;
                for(var l=0; l<n_lights; l++) {
                    uniformsText +=   "uniform float light"+l+"_On;\n" +
                    "uniform float light"+l+"_Type;\n" +
                    "uniform vec3  light"+l+"_Location;\n" +
                    "uniform vec3  light"+l+"_Direction;\n" +
                    "uniform vec3  light"+l+"_Color;\n" +
                    "uniform vec3  light"+l+"_Attenuation;\n" +
                    "uniform float light"+l+"_Radius;\n" +
                    "uniform float light"+l+"_Intensity;\n" +
                    "uniform float light"+l+"_AmbientIntensity;\n" +
                    "uniform float light"+l+"_BeamWidth;\n" +
                    "uniform float light"+l+"_CutOffAngle;\n" +
                    "uniform float light"+l+"_ShadowIntensity;\n";
                }
                return uniformsText;
            }
        }
    )
);

/* ### BlendedVolumeStyle ### */
x3dom.registerNodeType(
    "BlendedVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.BlendedVolumeStyle.superClass.call(this, ctx);

            this.addField_SFNode('renderStyle', x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode);
            this.addField_SFNode('voxels', x3dom.nodeTypes.X3DVolumeDataNode);
            this.addField_SFFloat(ctx, 'weightConstant1', 0.5);
            this.addField_SFFloat(ctx, 'weightConstant2', 0.5);
            this.addField_SFString(ctx, 'weightFunction1', "CONSTANT");
            this.addField_SFString(ctx, 'weightFunction2', "CONSTANT");
            this.addField_SFNode('weightTransferFunction1', x3dom.nodeTypes.X3DTexture2DNode);
            this.addField_SFNode('weightTransferFunction2', x3dom.nodeTypes.X3DTexture2DNode);

            this.uniformFloatWeightConstant1 = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatWeightConstant2 = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DVoxels = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DWeightTransferFunction1 = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DWeightTransferFunction2 = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'weightConstant1':
                        this.uniformFloatWeightConstant1._vf.value = this._vf.weightConstant1;
                        this.uniformFloatWeightConstant1.fieldChanged("value");
                        break;
                    case 'weightConstant2':
                        this.uniformFloatWeightConstant2._vf.value = this._vf.weightConstant2;
                        this.uniformFloatWeightConstant2.fieldChanged("value");
                        break;
                    case 'weightFunction1':
                        //TODO: Reload node
                        break;
                    case 'weightFunction2':
                        //TODO: Reload node
                        break;
                }
            },

            uniforms: function(){
                var unis = [];
                if (this._cf.voxels.node || this._cf.weightTransferFunction1.node || this._cf.weightTransferFunction2.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][BlendVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }

                    this.uniformSampler2DVoxels._vf.name = 'uVolBlendData';
                    this.uniformSampler2DVoxels._vf.type = 'SFInt32';
                    this.uniformSampler2DVoxels._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DVoxels);

                    if(this._cf.weightTransferFunction1.node){
                        this.uniformSampler2DWeightTransferFunction1._vf.name = 'uWeightTransferFunctionA';
                        this.uniformSampler2DWeightTransferFunction1._vf.type = 'SFInt32';
                        this.uniformSampler2DWeightTransferFunction1._vf.value = volumeDataParent._textureID++;
                        unis.push(this.uniformSampler2DWeightTransferFunction1);
                    }

                    if(this._cf.weightTransferFunction2.node){
                        this.uniformSampler2DWeightTransferFunction2._vf.name = 'uWeightTransferFunctionB';
                        this.uniformSampler2DWeightTransferFunction2._vf.type = 'SFInt32';
                        this.uniformSampler2DWeightTransferFunction2._vf.value = volumeDataParent._textureID++;
                        unis.push(this.uniformSampler2DWeightTransferFunction2);
                    }
                }

                this.uniformFloatWeightConstant1._vf.name = 'uWeightConstantA';
                this.uniformFloatWeightConstant1._vf.type = 'SFFloat';
                this.uniformFloatWeightConstant1._vf.value = this._vf.weightConstant1;
                unis.push(this.uniformFloatWeightConstant1);

                this.uniformFloatWeightConstant2._vf.name = 'uWeightConstantB';
                this.uniformFloatWeightConstant2._vf.type = 'SFFloat';
                this.uniformFloatWeightConstant2._vf.value = this._vf.weightConstant2;
                unis.push(this.uniformFloatWeightConstant2);

                //Also add the render style uniforms
                if (this._cf.renderStyle.node) {
                    var renderStyleUniforms = this._cf.renderStyle.node.uniforms();
                    Array.forEach(renderStyleUniforms, function(uni){
                        uni._vf.name = uni._vf.name.replace(/uSurfaceNormals/, "uBlendSurfaceNormals")
                    });
                    unis = unis.concat(renderStyleUniforms);       
                }
                return unis;
            },

            textures: function(){
                var texs = [];
                if (this._cf.voxels.node) {
                    var tex = this._cf.voxels.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }
                if (this._cf.weightTransferFunction1.node) {
                    var tex = this._cf.weightTransferFunction1.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }
                if (this._cf.weightTransferFunction2.node) {
                    var tex = this._cf.weightTransferFunction2.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }
                //Also add the render style textures
                if (this._cf.renderStyle.node) {
                    var renderStyleTextures = this._cf.renderStyle.node.textures();
                    texs = texs.concat(renderStyleTextures);       
                }
                return texs;
            },

            initializeValues: function(){
                var initialValues = "";
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    initialValues += "  vec3 ambientBlend = vec3(0.0, 0.0, 0.0);\n"+
                    "  vec3 diffuseBlend = vec3(0.0, 0.0, 0.0);\n"+
                    "  vec3 specularBlend = vec3(0.0, 0.0, 0.0);\n";
                }
                return initialValues;
            },

            styleUniformsShaderText: function(){
                var uniformsText = "uniform float uWeightConstantA;\n"+
                    "uniform float uWeightConstantB;\n"+
                    "uniform sampler2D uBlendSurfaceNormals;\n";
                    if(this._cf.voxels.node){
                        uniformsText += "uniform sampler2D uVolBlendData;\n";
                    }
                    if(this._cf.weightTransferFunction1.node){
                        uniformsText += "uniform sampler2D uWeightTransferFunctionA;\n";
                    }
                    if(this._cf.weightTransferFunction2.node){
                        uniformsText += "uniform sampler2D uWeightTransferFunctionB;\n";
                    }
                    //Also add the render style uniforms
                    if(this._cf.renderStyle.node) {
                        uniformsText += this._cf.renderStyle.node.styleUniformsShaderText();
                    }
                return uniformsText;
            },

            styleShaderText: function(){
                var styleText = "";
                if(this._cf.renderStyle.node && this._cf.renderStyle.node.styleShaderText!=undefined) {
                    styleText += this._cf.renderStyle.node.styleShaderText();
                }
                return styleText;
            },

            inlineStyleShaderText: function(){
                var nSlices = this._cf.voxels.node._vf.numberOfSlices.toPrecision(5);
                var xSlices = this._cf.voxels.node._vf.slicesOverX.toPrecision(5);
                var ySlices = this._cf.voxels.node._vf.slicesOverY.toPrecision(5);
                var inlineText = "    vec4 blendValue = cTexture3D(uVolBlendData,pos, "+ nSlices +", "+ xSlices +", "+ ySlices +");\n"+
                "    blendValue = vec4(blendValue.rgb,(0.299*blendValue.r)+(0.587*blendValue.g)+(0.114*blendValue.b));\n";
                if(this._cf.renderStyle.node && this._cf.renderStyle.node._cf.surfaceNormals.node){
                    inlineText += "    vec4 blendGradEye = getNormalFromTexture(uBlendSurfaceNormals, pos, "+ nSlices +", "+ xSlices +", "+ ySlices +");\n";
                }else{
                    inlineText += "    vec4 blendGradEye = getNormalOnTheFly(uVolBlendData, pos, "+ nSlices +", "+ xSlices +", "+ ySlices +");\n";
                }
                if (x3dom.nodeTypes.X3DLightNode.lightID>0){
                        inlineText += "    vec4 blendGrad = vec4((modelViewMatrixInverse * vec4(blendGradEye.xyz, 0.0)).xyz, blendGradEye.a);\n";
                }
                for(var l=0; l<x3dom.nodeTypes.X3DLightNode.lightID; l++) {
                    inlineText += "    lighting(light"+l+"_Type, " +
                    "light"+l+"_Location, " +
                    "light"+l+"_Direction, " +
                    "light"+l+"_Color, " + 
                    "light"+l+"_Attenuation, " +
                    "light"+l+"_Radius, " +
                    "light"+l+"_Intensity, " + 
                    "light"+l+"_AmbientIntensity, " +
                    "light"+l+"_BeamWidth, " +
                    "light"+l+"_CutOffAngle, " +
                    "blendGradEye.xyz, -positionE.xyz, ambientBlend, diffuseBlend, specularBlend);\n";
                }
                if(this._cf.renderStyle.node){
                    var tempText = this._cf.renderStyle.node.inlineStyleShaderText().replace(/value/gm, "blendValue").replace(/grad/gm, "blendGrad");
                    inlineText += tempText.replace(/ambient/gm, "ambientBlend").replace(/diffuse/gm, "diffuseBlend").replace(/specular/gm, "specularBlend");
                }
                //obtain the first weight
                switch(this._vf.weightFunction1.toUpperCase()){
                    case "CONSTANT":
                        inlineText += "    float wA = uWeightConstantA;\n";
                        break;
                    case "ALPHA0":
                        inlineText += "    float wA = value.a;\n";
                        break;
                    case "ALPHA1":
                        inlineText += "    float wA = blendValue.a;\n";
                        break;
                    case "ONE_MINUS_ALPHA0":
                        inlineText += "    float wA = 1.0 - value.a;\n";
                        break;
                    case "ONE_MINUS_ALPHA1":
                        inlineText += "    float wA = 1.0 - blendValue.a;\n";
                        break;
                    case "TABLE":
                        if(this._cf.weightTransferFunction1){
                            inlineText += "    float wA = texture2D(uWeightTransferFunctionA, vec2(value.a, blendValue.a));\n";
                        }else{
                            inlineText += "    float wA = value.a;\n";
                            x3dom.debug.logWarning('[VolumeRendering][BlendedVolumeStyle] TABLE specified on weightFunction1 but not weightTrnafer function provided, using ALPHA0.');
                        }
                        break;
                }
                //obtain the second weight
                switch(this._vf.weightFunction2.toUpperCase()){
                    case "CONSTANT":
                        inlineText += "    float wB = uWeightConstantB;\n";
                        break;
                    case "ALPHA0":
                        inlineText += "    float wB = value.a;\n";
                        break;
                    case "ALPHA1":
                        inlineText += "    float wB = blendValue.a;\n";
                        break;
                    case "ONE_MINUS_ALPHA0":
                        inlineText += "    float wB = 1.0 - value.a;\n";
                        break;
                    case "ONE_MINUS_ALPHA1":
                        inlineText += "    float wB = 1.0 - blendValue.a;\n";
                        break;
                    case "TABLE":
                        if(this._cf.weightTransferFunction2){
                            inlineText += "    float wB = texture2D(uWeightTransferFunctionB, vec2(value.a, blendValue.a));\n";
                        }else{
                            inlineText += "    float wB = value.a;\n";
                            x3dom.debug.logWarning('[VolumeRendering][BlendedVolumeStyle] TABLE specified on weightFunction2 but not weightTrasnferFunction provided, using ALPHA0.');
                        }
                        break;
                }
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    inlineText += "    value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n";
                }
                inlineText += "    value.rgb = clamp(value.rgb * wA + blendValue.rgb * wB, 0.0, 1.0);\n"+
                "    value.a = clamp(value.a * wA + blendValue.a * wB, 0.0, 1.0);\n";
                return inlineText;
            },

            lightAssigment: function(){
                return ""; //previously computed, empty string
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment(), this.initializeValues());
                return shader;
            }
        }
    )
);

/* ### BoundaryEnhancementVolumeStyle ### */
x3dom.registerNodeType(
    "BoundaryEnhancementVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.BoundaryEnhancementVolumeStyle.superClass.call(this, ctx);

            this.addField_SFFloat(ctx, 'retainedOpacity', 1);
            this.addField_SFFloat(ctx, 'boundaryOpacity', 0);
            this.addField_SFFloat(ctx, 'opacityFactor', 1);

            this.uniformFloatRetainedOpacity = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatBoundaryOpacity = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatOpacityFactor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DSurfaceNormals = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolEnableBoundary = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'retainedOpacity':
                        this.uniformFloatRetainedOpacity._vf.value = this._vf.retainedOpacity;
                        this.uniformFloatRetainedOpacity.fieldChanged("value");
                        break;
                    case 'boundaryOpacity':
                        this.uniformFloatBoundaryOpacity._vf.value = this._vf.boundaryOpacity;
                        this.uniformFloatBoundaryOpacity.fieldChanged("value");
                        break;
                    case 'opacityFactor':
                        this.uniformFloatOpacityFactor._vf.value = this._vf.opacityFactor;
                        this.uniformFloatOpacityFactor.fieldChanged("value");
                        break;
                }
            },

            uniforms: function(){
                var unis = [];
                if (this._cf.surfaceNormals.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][BoundaryEnhancementVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }
                    this.uniformSampler2DSurfaceNormals._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DSurfaceNormals._vf.type = 'SFInt32';
                    this.uniformSampler2DSurfaceNormals._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DSurfaceNormals);
                }

                this.uniformFloatRetainedOpacity._vf.name = 'uRetainedOpacity';
                this.uniformFloatRetainedOpacity._vf.type = 'SFFloat';
                this.uniformFloatRetainedOpacity._vf.value = this._vf.retainedOpacity;
                unis.push(this.uniformFloatRetainedOpacity);

                this.uniformFloatBoundaryOpacity._vf.name = 'uBoundaryOpacity';
                this.uniformFloatBoundaryOpacity._vf.type = 'SFFloat';
                this.uniformFloatBoundaryOpacity._vf.value = this._vf.boundaryOpacity;
                unis.push(this.uniformFloatBoundaryOpacity);

                this.uniformFloatOpacityFactor._vf.name = 'uOpacityFactor';
                this.uniformFloatOpacityFactor._vf.type = 'SFFloat';
                this.uniformFloatOpacityFactor._vf.value = this._vf.opacityFactor;
                unis.push(this.uniformFloatOpacityFactor);

                this.uniformBoolEnableBoundary._vf.name = 'uEnableBoundary';
                this.uniformBoolEnableBoundary._vf.type = 'SFBool';
                this.uniformBoolEnableBoundary._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEnableBoundary);
                return unis;
            },

            textures: function() {
                var texs = [];
                if (!(this._cf.surfaceNormals.node==null)) {
                    var tex = this._cf.surfaceNormals.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex)
                }
                return texs;
            },

            styleUniformsShaderText: function(){
                return "uniform float uRetainedOpacity;\n"+
                    "uniform float uBoundaryOpacity;\n"+
                    "uniform float uOpacityFactor;\n"+
                    "uniform bool uEnableBoundary;\n";
            },

            styleShaderText: function(){
                return "void boundaryEnhancement(inout vec4 original_color, float gradientMagnitude){\n"+
                "   original_color.a = original_color.a * (uRetainedOpacity + (uBoundaryOpacity*pow(gradientMagnitude, uOpacityFactor)));\n"+
                "}\n";
            },

            inlineStyleShaderText: function(){
                var inlineText = "    if(uEnableBoundary){\n"+
                "    boundaryEnhancement(value, grad.w);\n"+
                "}\n";
                return inlineText;
            },

            lightAssigment: function(){
                return "    value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n";
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### CartoonVolumeStyle ### */
x3dom.registerNodeType(
    "CartoonVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.CartoonVolumeStyle.superClass.call(this, ctx);

            this.addField_SFColor(ctx, 'parallelColor', 0, 0, 0);
            this.addField_SFColor(ctx, 'orthogonalColor', 1, 1, 1);
            this.addField_SFInt32(ctx, 'colorSteps', 4);

            this.uniformParallelColor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformOrthogonalColor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformIntColorSteps = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DSurfaceNormals = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolEnableCartoon = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'parallelColor':
                        this.uniformParallelColor._vf.value = this._vf.parallelColor;
                        this.uniformParallelColor.fieldChanged("value");
                        break;
                    case 'orthogonalColor':
                        this.uniformOrthogonalColor._vf.value = this._vf.orthogonalColor;
                        this.uniformOrthogonalColor.fieldChanged("value");
                        break;
                    case 'colorSteps':
                        this.uniformIntColorSteps._vf.value = this._vf.colorSteps;
                        this.uniformIntColorSteps.fieldChanged("value");
                        break;
                }
            },

            uniforms: function(){
                var unis = [];

                if (this._cf.surfaceNormals.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][CartoonVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }

                    this.uniformSampler2DSurfaceNormals._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DSurfaceNormals._vf.type = 'SFInt32';
                    this.uniformSampler2DSurfaceNormals._vf.value = volumeDataParent._textureID++; //FIXME: Number of textures could be variable
                    unis.push(this.uniformSampler2DSurfaceNormals);
                }

                this.uniformParallelColor._vf.name = 'uParallelColor';
                this.uniformParallelColor._vf.type = 'SFColor';
                this.uniformParallelColor._vf.value = this._vf.parallelColor;
                unis.push(this.uniformParallelColor);

                this.uniformOrthogonalColor._vf.name = 'uOrthogonalColor';
                this.uniformOrthogonalColor._vf.type = 'SFColor';
                this.uniformOrthogonalColor._vf.value = this._vf.orthogonalColor;
                unis.push(this.uniformOrthogonalColor);

                this.uniformIntColorSteps._vf.name = 'uColorSteps';
                this.uniformIntColorSteps._vf.type = 'SFInt32';
                this.uniformIntColorSteps._vf.value = this._vf.colorSteps;
                unis.push(this.uniformIntColorSteps);

                this.uniformBoolEnableCartoon._vf.name = 'uEnableCartoon';
                this.uniformBoolEnableCartoon._vf.type = 'SFBool';
                this.uniformBoolEnableCartoon._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEnableCartoon);

                return unis;
            },

            textures: function() {
                var texs = [];
                if (this._cf.surfaceNormals.node) {
                    var tex = this._cf.surfaceNormals.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }
                return texs;
            },

            styleShaderText: function(){
                return "//Convert RGBA color to HSVA\n"+
                "vec4 rgba2hsva(vec4 rgba){\n"+
                "   float zat, izen;\n"+
                "   float R = rgba.r, G = rgba.g, B = rgba.b;\n"+
                "   float minim = min(R, min(G, B)), maxim = max(R, max(G, B));\n"+
                "   float delta = maxim-minim;\n"+
                "   if(minim == maxim){\n"+
                "       return vec4(0.0, 0.0, maxim, rgba.a);\n"+
                "   }else{\n"+
                "       zat = (R == maxim) ? G - B : ((G == maxim) ? B - R : R - G);\n"+ 
                "       izen = (R == maxim) ? ((G<B) ? 6.0 : 0.0) : ((G == maxim) ? 2.0 : 4.0);\n"+ 
                "        return vec4((zat/delta + izen)/6.0, delta/maxim, maxim, rgba.a);\n"+ 
                "    }\n"+
                "}\n"+
                "\n"+
                "//Convert RGB color to HSV\n"+
                "vec3 rgb2hsv(vec3 rgb){\n"+
                "    return rgba2hsva(vec4(rgb, 1.0)).rgb;\n"+
                "}\n"+
                "\n"+
                "//Convert HSVA color to RGBA\n"+
                "vec4 hsva2rgba(vec4 hsva){\n"+
                "   float r, g, b;\n"+
                "   float h=hsva.x, s=hsva.y, v=hsva.z;\n"+
                "   float i = floor(h * 6.0);\n"+
                "   float f = h * 6.0 - i;\n"+
                "   float p = v * (1.0 - s);\n"+
                "   float q = v * (1.0 - f * s);\n"+
                "   float t = v * (1.0 - (1.0 - f) * s);\n"+
                "   i = mod(i,6.0);\n"+
                "   if( i == 6.0 || i == 0.0 ) r = v, g = t, b = p;\n"+
                "   else if( i == 1.0) r = q, g = v, b = p;\n"+
                "   else if( i == 2.0) r = p, g = v, b = t;\n"+
                "   else if( i == 3.0) r = p, g = q, b = v;\n"+
                "   else if( i == 4.0) r = t, g = p, b = v;\n"+
                "   else if( i == 5.0) r = v, g = p, b = q;\n"+
                "   return vec4(r,g,b,hsva.w);\n"+
                "}\n"+
                "\n"+
                "//Convert HSV color to RGB\n"+
                "vec3 hsv2rgb(vec3 hsv){\n"+
                "   return hsva2rgba(vec4(hsv, 1.0)).rgb;\n"+
                "}\n"+
                "void getCartoonStyle(inout vec4 outputColor, vec3 orthogonalColor, vec3 parallelColor, int colorSteps, vec3 surfNormal, vec3 V)\n"+
                "{\n"+
                "   if(colorSteps > 0 && colorSteps <= 64){\n"+
                "       float cos_angle = dot(surfNormal, V);\n"+
                "       if(cos_angle <= 0.0){\n"+
                "           outputColor.rgb = parallelColor.rgb;\n"+
                "       }else{\n"+
                "           if(cos_angle < 1.0){\n"+
                "               float range_size = pi_half / float(colorSteps);\n"+
                "               float interval = floor(cos_angle / range_size);\n"+
                "               float ang = interval * range_size;\n"+
                "               if(interval >= float(colorSteps))\n"+
                "                   interval = float(colorSteps) - 1.0;\n"+
                "               outputColor.rgb = hsv2rgb(mix(orthogonalColor, parallelColor, ang));\n"+
                "           }else{\n"+
                "               outputColor.rgb = orthogonalColor.rgb;\n"+
                "           }\n"+
                "       }\n"+
                "   }else{\n"+
                "       outputColor.a = 0.0; //No color steps as input parameter\n"+
                "   }\n"+
                "}\n"+
                "\n";
            },

            styleUniformsShaderText: function(){
                return "uniform vec3 uParallelColor;\n"+
                "uniform vec3 uOrthogonalColor;\n"+
                "uniform int uColorSteps;\n"+
                "uniform bool uEnableCartoon;\n"+
                "const float pi_half = "+ (Math.PI/2.0).toPrecision(5) +";\n";
            },

            inlineStyleShaderText: function(){
                var inlineText = "  if(uEnableCartoon){\n"+
                "      getCartoonStyle(value, rgb2hsv(uOrthogonalColor), rgb2hsv(uParallelColor), uColorSteps, grad.xyz, normalize(dir));\n"+
                "  }\n";   
                return inlineText;
            },

            lightAssigment: function(){
                return "    value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n";
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### ComposedVolumeStyle ### */
x3dom.registerNodeType(
    "ComposedVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.ComposedVolumeStyle.superClass.call(this, ctx);

            this.addField_SFBool(ctx, 'ordered', false);
            this.addField_MFNode('renderStyle', x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode);
            //Using only one normal texture
            this.normalTextureProvided = false;
        },
        {
            uniforms: function(){
                var unis = [];
                var i, n = this._cf.renderStyle.nodes.length;
                for (i=0; i<n; i++){
                    //Not repeat common uniforms, TODO: Allow multiple surface normals
                    var that = this;
                    Array.forEach(this._cf.renderStyle.nodes[i].uniforms(), function(uniform){
                        var contains_uniform = false;
                        Array.forEach(unis, function(accum){
                            if(accum._vf.name == uniform._vf.name){
                                contains_uniform = true;
                            }
                        });
                        if (contains_uniform == false){
                            unis = unis.concat(uniform);
                        }
                    });
                }
                return unis;
            },

            textures: function() {
                var texs = [];
                var i, n = this._cf.renderStyle.nodes.length;
                for (i=0; i<n; i++){
                    //Not repeat same textures, TODO: Allow multiply surface normals textures
                    Array.forEach(this._cf.renderStyle.nodes[i].textures(), function(texture){
                        var contains_texture = false;
                        Array.forEach(texs, function(accum){
                            if(accum._vf.url[0] == texture._vf.url[0]){
                                contains_texture = true;
                            }
                        });
                        if (contains_texture == false){
                            texs = texs.concat(texture);
                        }
                    });
                   
                }
                return texs;
            },

            initializeValues: function() {
                var initialValues ="";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    if(this._cf.renderStyle.nodes[i].initializeValues != undefined){
                        initialValues += this._cf.renderStyle.nodes[i].initializeValues() + "\n";
                    }
                }
                return initialValues;
            },

            styleUniformsShaderText: function(){
                var styleText = "";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    styleText += this._cf.renderStyle.nodes[i].styleUniformsShaderText() + "\n";
                    if(this._cf.renderStyle.nodes[i]._cf.surfaceNormals && this._cf.renderStyle.nodes[i]._cf.surfaceNormals.node != null){
                        this.normalTextureProvided = true;
                        this._cf.surfaceNormals.node = this._cf.renderStyle.nodes[i]._cf.surfaceNormals.node;
                    }
                }
                return styleText;
            },

            styleShaderText: function(){
                var styleText = "";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    if(this._cf.renderStyle.nodes[i].styleShaderText != undefined){
                        styleText += this._cf.renderStyle.nodes[i].styleShaderText() + "\n";
                    }
                }
                return styleText;
            },

            inlineStyleShaderText: function(){
                var inlineText = "";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    inlineText += this._cf.renderStyle.nodes[i].inlineStyleShaderText();
                }
                /*if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    inlineText += this._cf.renderStyle.nodes[0].lightAssigment();
                }*/
                return inlineText;
            },

            lightAssigment: function(){
                var isBlendedStyle = false;
                //Check if there is a blendedStyle, not to use lightAssigment
                Array.forEach(this._cf.renderStyle.nodes, function(style){
                    if(x3dom.isa(style, x3dom.nodeTypes.BlendedVolumeStyle)){
                        isBlendedStyle = true;
                    }
                });
                if(!isBlendedStyle){
                    return this._cf.renderStyle.nodes[0].lightAssigment();
                }else{
                    return "";
                }
            },

            lightEquationShaderText: function(){
                return this._cf.renderStyle.nodes[0].lightEquationShaderText();
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY, offset){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText();
                if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                    //Only from the first render style
                    shader += this.lightEquationShaderText();
                }
                shader += this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment(), this.initializeValues());
                return shader;
            }
        }
    )
);

/* ### EdgeEnhancementVolumeStyle ### */
x3dom.registerNodeType(
    "EdgeEnhancementVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.EdgeEnhancementVolumeStyle.superClass.call(this, ctx);

            this.addField_SFColor(ctx, 'edgeColor', 0, 0, 0);
            this.addField_SFFloat(ctx, 'gradientThreshold', 0.4);

            this.uniformColorEdgeColor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatGradientThreshold = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DSurfaceNormals = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolEdgeEnable = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                if (fieldName == "edgeColor") {
                    this.uniformColorEdgeColor._vf.value = this._vf.edgeColor;
                    this.uniformColorEdgeColor.fieldChanged("value");
                }else if (fieldName == "gradientThreshold") {
                    this.uniformFloatGradientThreshold._vf.value = this._vf.gradientThreshold;
                    this.uniformFloatGradientThreshold.fieldChanged("value");
                }
            },

            uniforms: function(){
                var unis = [];
                if (this._cf.surfaceNormals.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][EdgeEnhancementVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }
                    this.uniformSampler2DSurfaceNormals._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DSurfaceNormals._vf.type = 'SFInt32';
                    this.uniformSampler2DSurfaceNormals._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DSurfaceNormals);
                }

                this.uniformColorEdgeColor._vf.name = 'uEdgeColor';
                this.uniformColorEdgeColor._vf.type = 'SFColor';
                this.uniformColorEdgeColor._vf.value = this._vf.edgeColor;
                unis.push(this.uniformColorEdgeColor);

                this.uniformFloatGradientThreshold._vf.name = 'uGradientThreshold';
                this.uniformFloatGradientThreshold._vf.type = 'SFFloat';
                this.uniformFloatGradientThreshold._vf.value = this._vf.gradientThreshold;
                unis.push(this.uniformFloatGradientThreshold);

                this.uniformBoolEdgeEnable._vf.name = 'uEnableEdge';
                this.uniformBoolEdgeEnable._vf.type = 'SFBool';
                this.uniformBoolEdgeEnable._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEdgeEnable);
                return unis;
            },

            textures: function() {
                var texs = [];
                if (this._cf.surfaceNormals.node) {
                    var tex = this._cf.surfaceNormals.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex)
                }
                return texs;
            },

            styleUniformsShaderText: function(){
                return "uniform vec3 uEdgeColor;\n"+
                    "uniform float uGradientThreshold;\n"+
                    "uniform bool uEnableEdge;\n";
            },

            styleShaderText: function(){
                return "void edgeEnhancement(inout vec4 originalColor, vec4 gradient, vec3 V)\n"+
                "{\n"+
                "   if(gradient.w > 0.001){\n"+
                "       float angle_dif = abs(dot(gradient.xyz,V));\n"+
                "       if (angle_dif<=cos(uGradientThreshold)){\n"+
                "           originalColor.rgb = mix(uEdgeColor, originalColor.rgb, angle_dif);\n"+
                "       }\n"+
                "   }\n"+
                "}\n";
            },

            inlineStyleShaderText: function(){
                var inlineText = "   if(uEnableEdge){\n"+
                "       edgeEnhancement(value, grad, normalize(dir));\n"+
                "   }\n";
                return inlineText;
            },

            lightAssigment: function(){
                return "    value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n";
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### ISOSurfaceVolumeData ### */
x3dom.registerNodeType(
    "ISOSurfaceVolumeData",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DVolumeDataNode,
        function (ctx) {
            x3dom.nodeTypes.ISOSurfaceVolumeData.superClass.call(this, ctx);

            this.addField_MFNode('renderStyle', x3dom.nodeTypes.X3DVolumeRenderStyleNode);
            this.addField_SFNode('gradients', x3dom.nodeTypes.Texture);
            //this.addField_SFNode('gradients', x3dom.nodeTypes.X3DTexture3DNode);
            this.addField_MFFloat(ctx, 'surfaceValues', [0.0]);
            this.addField_SFFloat(ctx, 'contourStepSize', 0);
            this.addField_SFFloat(ctx, 'surfaceTolerance', 0);

            this.uniformSampler2DGradients = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatContourStepSize = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatSurfaceTolerance = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatArraySurfaceValues = new x3dom.nodeTypes.Uniform(ctx);
            this.normalTextureProvided = false;

            this.vrcMultiTexture = new x3dom.nodeTypes.MultiTexture(ctx);
            this.vrcRenderTexture = new x3dom.nodeTypes.RenderedTexture(ctx);
            this.vrcVolumeTexture = null;

            this.vrcBackCubeShape = new x3dom.nodeTypes.Shape(ctx);
            this.vrcBackCubeAppearance = new x3dom.nodeTypes.Appearance();
            this.vrcBackCubeGeometry = new x3dom.nodeTypes.Box(ctx);
            this.vrcBackCubeShader = new x3dom.nodeTypes.ComposedShader(ctx);
            this.vrcBackCubeShaderVertex = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcBackCubeShaderFragment = new x3dom.nodeTypes.ShaderPart(ctx);

            this.vrcFrontCubeShader = new x3dom.nodeTypes.ComposedShader(ctx);
            this.vrcFrontCubeShaderVertex = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcFrontCubeShaderFragment = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcFrontCubeShaderFieldBackCoord = new x3dom.nodeTypes.Field(ctx);
            this.vrcFrontCubeShaderFieldVolData = new x3dom.nodeTypes.Field(ctx);
            this.vrcFrontCubeShaderFieldOffset = new x3dom.nodeTypes.Field(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'surfaceValues':
                        this.uniformFloatArraySurfaceValues._vf.value = this._vf.surfaceValues;
                        this.uniformFloatArraySurfaceValues.fieldChanged("value");
                        //TODO: Reload node
                        break;
                    case 'surfaceTolerance':
                        this.uniformFloatSurfaceTolerance._vf.value = this._vf.surfaceTolerance;
                        this.uniformFloatSurfaceTolerance.fieldChanged("value");
                        break;
                    case 'contourStepSize':
                        //TODO: Reload node
                        break;
                }
            },

            uniforms: function(){
                var unis = [];

                if (this._cf.gradients.node){
                    this.uniformSampler2DGradients._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DGradients._vf.type = 'SFInt32';
                    this.uniformSampler2DGradients._vf.value = this._textureID++;
                    unis.push(this.uniformSampler2DGradients);
                }

                this.uniformFloatArraySurfaceValues._vf.name = 'uSurfaceValues';
                this.uniformFloatArraySurfaceValues._vf.type = 'MFFloat';
                this.uniformFloatArraySurfaceValues._vf.value = this._vf.surfaceValues;
                unis.push(this.uniformFloatArraySurfaceValues);

                /*this.uniformFloatContourStepSize._vf.name = 'uContourStepSize';
                this.uniformFloatContourStepSize._vf.type = 'SFFloat';
                this.uniformFloatContourStepSize._vf.value = this._vf.contourStepSize;
                unis.push(this.uniformFloatContourStepSize);*/

                this.uniformFloatSurfaceTolerance._vf.name = 'uSurfaceTolerance';
                this.uniformFloatSurfaceTolerance._vf.type = 'MFFloat';
                this.uniformFloatSurfaceTolerance._vf.value = this._vf.surfaceTolerance;
                unis.push(this.uniformFloatSurfaceTolerance);

                if (this._cf.renderStyle.nodes) {
                    var n = this._cf.renderStyle.nodes.length;
                    for (var i=0; i<n; i++){
                        //Not repeat common uniforms, TODO: Allow multiple surface normals
                        Array.forEach(this._cf.renderStyle.nodes[i].uniforms(), function(uniform){
                            var contains_uniform = false;
                            Array.forEach(unis, function(accum){
                                if(accum._vf.name == uniform._vf.name){
                                    contains_uniform = true;
                                }
                            });
                            if (contains_uniform == false){
                                unis = unis.concat(uniform);
                            }
                        });
                    }    
                }
                return unis;
            },

            textures: function(){
                var texs = [];
                if(this._cf.gradients.node){
                    var tex = this._cf.gradients.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }

                var i, n = this._cf.renderStyle.nodes.length;
                for (i=0; i<n; i++){
                    //Not repeat same textures, TODO: Allow multiply surface normals textures
                    Array.forEach(this._cf.renderStyle.nodes[i].textures(), function(texture){
                        var contains_texture = false;
                        Array.forEach(texs, function(accum){
                            if(accum._vf.url[0] == texture._vf.url[0]){
                                contains_texture = true;
                            }
                        });
                        if (contains_texture == false){
                            texs = texs.concat(texture);
                        }
                    });
                }
                return texs;
            },

            initializeValues: function() {
                var initialValues ="  float previous_value = 0.0;\n";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    if(this._cf.renderStyle.nodes[i].initializeValues != undefined){
                        initialValues += this._cf.renderStyle.nodes[i].initializeValues() + "\n";
                    }
                }
                return initialValues;
            },

            styleUniformsShaderText: function(){
                var styleText = "uniform float uSurfaceTolerance;\n"+
                //"uniform float uContourStepSize;\n"+
                "uniform float uSurfaceValues["+this._vf.surfaceValues.length+"];\n";
                if(this._cf.gradients.node){
                    styleText += "uniform sampler2D uSurfaceNormals;\n";
                }
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    styleText += this._cf.renderStyle.nodes[i].styleUniformsShaderText() + "\n";
                    if(this._cf.renderStyle.nodes[i]._cf.surfaceNormals && this._cf.renderStyle.nodes[i]._cf.surfaceNormals.node != null){
                        this.normalTextureProvided = true;
                        this.surfaceNormals = this._cf.renderStyle.nodes[i]._cf.surfaceNormals.node;
                    }
                }
                return styleText;
            },

            inlineStyleShaderText: function(){
                var inlineText = "    sample = value.r;\n";
                if(this._vf.surfaceValues.length == 1) { //Only one surface value
                    if(this._vf.contourStepSize == 0.0){
                        inlineText += "   if((sample>=uSurfaceValues[0] && previous_value<uSurfaceValues[0])||(sample<uSurfaceValues[0] && previous_value>=uSurfaceValues[0]) && (grad.a>=uSurfaceTolerance)){\n"+
                        "       value = vec4(uSurfaceValues[0]);\n";
                        if(this._cf.renderStyle.nodes){
                            inlineText += this._cf.renderStyle.nodes[0].inlineStyleShaderText();
                        }
                        inlineText += "       accum.rgb += (1.0 - accum.a) * (value.rgb * value.a);\n"+
                        "       accum.a += value.a;\n"+
                        "   }\n"; 
                    }else{ //multiple iso values with the contour step size
                        var tmp = this._vf.surfaceValues[0];
                        var positive_range = [];
                        var negative_range = [];
                        while(tmp+this._vf.contourStepSize <= 1.0){
                            tmp+=this._vf.contourStepSize;
                            positive_range.push(tmp);
                        }
                        tmp = this._vf.surfaceValues[0];
                        while(tmp-this._vf.contourStepSize >= 0.0){
                            tmp-=this._vf.contourStepSize;
                            positive_range.push(tmp);
                        }
                        var range = Array.concat(negative_range.reverse(), positive_range);
                        for (var i = 0; i <= range.length - 1; i++) {
                            var s_value = range[i].toPrecision(3);
                            inlineText += " if((sample>="+s_value+" && previous_value<"+s_value+")||(sample<"+s_value+" && previous_value>="+s_value+") && (grad.a>=uSurfaceTolerance)){\n"+
                            "       value = vec4("+s_value+");\n";
                            if(this._cf.renderStyle.nodes){
                                inlineText += this._cf.renderStyle.nodes[0].inlineStyleShaderText();
                            }
                            inlineText += "       accum.rgb += (1.0 - accum.a) * (value.rgb * value.a);\n"+
                            "       accum.a += value.a;\n"+
                            "   }\n"; 
                        };
                    }
                }else{ //Multiple isosurface values had been specified by the user
                    var n_styles = this._cf.renderStyle.nodes.length-1;
                    var s_values = this._vf.surfaceValues.length;
                    for(var i=0; i<s_values; i++){
                        var index = Math.min(i, n_styles);
                        inlineText += "   if((sample>=uSurfaceValues["+i+"] && previous_value<uSurfaceValues["+i+"])||(sample<uSurfaceValues["+i+"] && previous_value>=uSurfaceValues["+i+"]) && (grad.a>=uSurfaceTolerance)){\n"+
                        "       value.rgb = vec3(uSurfaceValues["+i+"]);\n";
                        if(this._cf.renderStyle.nodes){
                            inlineText += this._cf.renderStyle.nodes[index].inlineStyleShaderText();
                        }
                        inlineText += "   accum.rgb += (1.0 - accum.a) * (value.rgb * value.a);\n"+
                        "   accum.a += value.a;\n"+
                        "   }\n"; 
                    }
                }
                inlineText += "    previous_value = sample;\n";
                return inlineText;
            },

            styleShaderText: function(){
                var styleText = "";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    if(this._cf.renderStyle.nodes[i].styleShaderText != undefined){
                        styleText += this._cf.renderStyle.nodes[i].styleShaderText()+"\n";
                    }
                }
                return styleText;
            },

            lightAssigment: function(){
                var isBlendedStyle = false;
                //Check if there is a blendedStyle, not to use lightAssigment
                Array.forEach(this._cf.renderStyle.nodes, function(style){
                    if(x3dom.isa(style, x3dom.nodeTypes.BlendedVolumeStyle)){
                        isBlendedStyle = true;
                    }
                });
                if(!isBlendedStyle){
                    return this._cf.renderStyle.nodes[0].lightAssigment();
                }else{
                    return "";
                }
            },

            lightEquationShaderText: function(){ //TODO: ligth equation per isosurface?
                return this._cf.renderStyle.nodes[0].lightEquationShaderText();
            },

            nodeChanged: function()
            {
                if (!this._cf.appearance.node) 
                {
                    var that = this;
                    var i;

                    this.addChild(x3dom.nodeTypes.Appearance.defaultNode());
                    
                    // second texture, ray direction and length
                    this.vrcBackCubeShaderVertex._vf.type = 'vertex';
                    this.vrcBackCubeShaderVertex._vf.url[0] =
                        "attribute vec3 position;\n" +
                        "attribute vec3 color;\n" +
                        "varying vec3 fragColor;\n" +
                        "uniform mat4 modelViewProjectionMatrix;\n" +
                        "\n" +
                        "void main(void) {\n" +
                        "    fragColor = color;\n" +
                        "    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);\n" +
                        "}\n";

                    this.vrcBackCubeShaderFragment._vf.type = 'fragment';
                    this.vrcBackCubeShaderFragment._vf.url[0] =
                        "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
                        "  precision highp float;\n" +
                        "#else\n" +
                        "  precision mediump float;\n" +
                        "#endif\n" +
                        "\n" +
                        "varying vec3 fragColor;\n" +
                        "\n" +
                        "void main(void) {\n" +
                        "    gl_FragColor = vec4(fragColor, 1.0);\n" +
                        "}\n";
                    
                    this.vrcBackCubeShader.addChild(this.vrcBackCubeShaderFragment, 'parts');
                    this.vrcBackCubeShaderFragment.nodeChanged();
                    
                    this.vrcBackCubeShader.addChild(this.vrcBackCubeShaderVertex, 'parts');
                    this.vrcBackCubeShaderVertex.nodeChanged();
                    
                    this.vrcBackCubeAppearance.addChild(this.vrcBackCubeShader);
                    this.vrcBackCubeShader.nodeChanged();
                    
                    // initialize fbo - note that internally the datatypes must fit!
                    this.vrcRenderTexture._vf.update = 'always';
                    this.vrcRenderTexture._vf.dimensions = [500, 500, 4];
                    this.vrcRenderTexture._vf.repeatS = false;
                    this.vrcRenderTexture._vf.repeatT = false;
                    this.vrcRenderTexture._nameSpace = this._nameSpace;
                    this._textureID++;

                    this.vrcBackCubeGeometry._vf.size = new x3dom.fields.SFVec3f(
                        this._vf.dimensions.x, this._vf.dimensions.y, this._vf.dimensions.z);
                    this.vrcBackCubeGeometry._vf.ccw = false;
                    this.vrcBackCubeGeometry._vf.solid = true;
                    // manually trigger size update
                    this.vrcBackCubeGeometry.fieldChanged("size");
                    
                    this.vrcBackCubeShape.addChild(this.vrcBackCubeGeometry);
                    this.vrcBackCubeGeometry.nodeChanged();
                    
                    this.vrcBackCubeShape.addChild(this.vrcBackCubeAppearance);
                    this.vrcBackCubeAppearance.nodeChanged();
                    
                    this.vrcRenderTexture.addChild(this.vrcBackCubeShape, 'scene');
                    this.vrcBackCubeShape.nodeChanged();
                    
                    // create shortcut to volume data set
                    this.vrcVolumeTexture = this._cf.voxels.node;
                    this.vrcVolumeTexture._vf.repeatS = false;
                    this.vrcVolumeTexture._vf.repeatT = false;
                    this._textureID++;

                    this.vrcMultiTexture._nameSpace = this._nameSpace;
                    
                    this.vrcMultiTexture.addChild(this.vrcRenderTexture, 'texture');
                    this.vrcRenderTexture.nodeChanged();
                    
                    this.vrcMultiTexture.addChild(this.vrcVolumeTexture, 'texture');
                    this.vrcVolumeTexture.nodeChanged();
                    
                    // textures from styles
                    var styleTextures = this.textures();
                    for (i = 0; i<styleTextures.length; i++)
                    {
                        this.vrcMultiTexture.addChild(styleTextures[i], 'texture');
                        this.vrcVolumeTexture.nodeChanged();
                    }
                    
                    this._cf.appearance.node.addChild(this.vrcMultiTexture);
                    this.vrcMultiTexture.nodeChanged();
                    
                    // here goes the volume shader
                    this.vrcFrontCubeShaderVertex._vf.type = 'vertex';
                    var shaderText=
                    "attribute vec3 position;\n"+
                    "attribute vec3 color;\n"+
                    "uniform mat4 modelViewProjectionMatrix;\n"+
                    "varying vec3 vertexColor;\n"+
                    "varying vec4 vertexPosition;\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText += "uniform mat4 modelViewMatrix;\n"+
                        "varying vec4 position_eye;\n";
                    }
                    shaderText += "\n" +
                    "void main()\n"+
                    "{\n"+
                    "  vertexColor = color;\n"+
                    "  vertexPosition = modelViewProjectionMatrix * vec4(position, 1.0);\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                       shaderText += "  position_eye = modelViewMatrix * vec4(position, 1.0);\n";
                    }
                    shaderText += 
                    "  gl_Position = vertexPosition;\n"+
                    "}";
                    this.vrcFrontCubeShaderVertex._vf.url[0] = shaderText;

                    this.vrcFrontCubeShaderFragment._vf.type = 'fragment';
                    shaderText =
                    "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
                    "  precision highp float;\n" +
                    "#else\n" +
                    "  precision mediump float;\n" +
                    "#endif\n\n"+
                    "uniform sampler2D uBackCoord;\n"+
                    "uniform sampler2D uVolData;\n"+
                    "uniform vec3 offset;\n"+
                    "uniform mat4 modelViewMatrixInverse;\n"+
                    "uniform mat4 modelViewMatrix;\n"+
                    //"uniform sampler2D uSurfaceNormals;\n"+
                    "varying vec3 vertexColor;\n"+
                    "varying vec4 vertexPosition;\n"+
                    "varying vec4 position_eye;\n"+
                    "const float Steps = 60.0;\n"+
                    "const float numberOfSlices = "+ this.vrcVolumeTexture._vf.numberOfSlices.toPrecision(5)+";\n"+
                    "const float slicesOverX = " + this.vrcVolumeTexture._vf.slicesOverX.toPrecision(5) +";\n"+
                    "const float slicesOverY = " + this.vrcVolumeTexture._vf.slicesOverY.toPrecision(5) +";\n";
                    //LIGHTS
                    var n_lights = x3dom.nodeTypes.X3DLightNode.lightID;
                    for(var l=0; l<n_lights; l++) {
                        shaderText +=   "uniform float light"+l+"_On;\n" +
                        "uniform float light"+l+"_Type;\n" +
                        "uniform vec3  light"+l+"_Location;\n" +
                        "uniform vec3  light"+l+"_Direction;\n" +
                        "uniform vec3  light"+l+"_Color;\n" +
                        "uniform vec3  light"+l+"_Attenuation;\n" +
                        "uniform float light"+l+"_Radius;\n" +
                        "uniform float light"+l+"_Intensity;\n" +
                        "uniform float light"+l+"_AmbientIntensity;\n" +
                        "uniform float light"+l+"_BeamWidth;\n" +
                        "uniform float light"+l+"_CutOffAngle;\n" +
                        "uniform float light"+l+"_ShadowIntensity;\n";
                    }
                    shaderText += this.styleUniformsShaderText()+
                    this.styleShaderText()+
                    "vec4 cTexture3D(sampler2D vol, vec3 volpos, float nS, float nX, float nY)\n"+
                    "{\n"+
                    "  float s1,s2;\n"+
                    "  float dx1,dy1;\n"+
                    "  float dx2,dy2;\n"+
                    "  vec2 texpos1,texpos2;\n"+
                    "  s1 = floor(volpos.z*nS);\n"+
                    "  s2 = s1+1.0;\n"+
                    "  dx1 = fract(s1/nX);\n"+
                    "  dy1 = floor(s1/nY)/nY;\n"+
                    "  dx2 = fract(s2/nX);\n"+
                    "  dy2 = floor(s2/nY)/nY;\n"+
                    "  texpos1.x = dx1+(volpos.x/nX);\n"+
                    "  texpos1.y = dy1+(volpos.y/nY);\n"+
                    "  texpos2.x = dx2+(volpos.x/nX);\n"+
                    "  texpos2.y = dy2+(volpos.y/nY);\n"+
                    "  return mix( texture2D(vol,texpos1), texture2D(vol,texpos2), (volpos.z*nS)-s1);\n"+
                    "}\n"+
                    "\n"+
                    "vec4 getNormalFromTexture(sampler2D sampler, vec3 pos, float nS, float nX, float nY) {\n"+
                    "   vec4 n = (2.0*cTexture3D(sampler, pos, nS, nX, nY)-1.0);\n"+
                    "   n.a = length(n.xyz);\n"+
                    "   n.xyz = normalize(n.xyz);\n"+
                    "   return n;\n"+
                    "}\n"+
                    "\n"+
                    "vec4 getNormalOnTheFly(sampler2D sampler, vec3 voxPos, float nS, float nX, float nY){\n"+
                    "   float v0 = cTexture3D(sampler, voxPos + vec3(offset.x, 0, 0), nS, nX, nY).r;\n"+
                    "   float v1 = cTexture3D(sampler, voxPos - vec3(offset.x, 0, 0), nS, nX, nY).r;\n"+
                    "   float v2 = cTexture3D(sampler, voxPos + vec3(0, offset.y, 0), nS, nX, nY).r;\n"+
                    "   float v3 = cTexture3D(sampler, voxPos - vec3(0, offset.y, 0), nS, nX, nY).r;\n"+
                    "   float v4 = cTexture3D(sampler, voxPos + vec3(0, 0, offset.z), nS, nX, nY).r;\n"+
                    "   float v5 = cTexture3D(sampler, voxPos - vec3(0, 0, offset.z), nS, nX, nY).r;\n"+
                    "   vec3 grad = vec3((v0-v1)/2.0, (v2-v3)/2.0, (v4-v5)/2.0);\n"+
                    "   return vec4(normalize(grad), length(grad));\n"+
                    "}\n"+
                    "\n"+
                    this.lightEquationShaderText();
                    shaderText += "void main()\n"+
                    "{\n"+
                    "  vec2 texC = vertexPosition.xy/vertexPosition.w;\n"+
                    "  texC = 0.5*texC + 0.5;\n"+
                    "  vec4 backColor = texture2D(uBackCoord,texC);\n"+
                    "  vec3 dir = backColor.rgb - vertexColor.rgb;\n"+
                    "  vec3 pos = vertexColor;\n"+
                    "  vec4 accum  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                    "  float sample = 0.0;\n"+
                    "  vec4 value  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                    "  float cont = 0.0;\n"+
                    "  vec3 step = dir/Steps;\n";
                    //Light init values
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText +=
                        "  vec3 ambient = vec3(0.0, 0.0, 0.0);\n"+
                        "  vec3 diffuse = vec3(0.0, 0.0, 0.0);\n"+
                        "  vec3 specular = vec3(0.0, 0.0, 0.0);\n"+
                        "  vec4 step_eye = modelViewMatrix * vec4(step, 0.0);\n"+
                        "  vec4 positionE = position_eye;\n"+
                        "  float lightFactor = 1.0;\n"; 
                    }else{
                        shaderText += "  float lightFactor = 1.2;\n";
                    }
                    shaderText += this.initializeValues()+
                    "  float opacityFactor = 6.0;\n"+
                    "  for(float i = 0.0; i < Steps; i+=1.0)\n"+
                    "  {\n"+
                    "    value = cTexture3D(uVolData, pos, numberOfSlices, slicesOverX, slicesOverY);\n"+
                    "    value = vec4(value.rgb,(0.299*value.r)+(0.587*value.g)+(0.114*value.b));\n";
                    if(this._cf.gradients.node){
                        shaderText += "    vec4 gradEye = getNormalFromTexture(uSurfaceNormals, pos, numberOfSlices, slicesOverX, slicesOverY);\n";
                    }else{
                        shaderText += "    vec4 gradEye = getNormalOnTheFly(uVolData, pos, numberOfSlices, slicesOverX, slicesOverY);\n";
                    }
                    shaderText += "    vec4 grad = vec4((modelViewMatrixInverse * vec4(gradEye.xyz, 0.0)).xyz, gradEye.a);\n";
                    for(var l=0; l<x3dom.nodeTypes.X3DLightNode.lightID; l++) {
                        shaderText += "    lighting(light"+l+"_Type, " +
                        "light"+l+"_Location, " +
                        "light"+l+"_Direction, " +
                        "light"+l+"_Color, " + 
                        "light"+l+"_Attenuation, " +
                        "light"+l+"_Radius, " +
                        "light"+l+"_Intensity, " + 
                        "light"+l+"_AmbientIntensity, " +
                        "light"+l+"_BeamWidth, " +
                        "light"+l+"_CutOffAngle, " +
                        "grad.xyz, -positionE.xyz, ambient, diffuse, specular);\n";
                    }
                    shaderText += this.inlineStyleShaderText();
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText += this.inlineLightAssigment();
                    }
                    shaderText +=
                    "    //advance the current position\n"+
                    "    pos.xyz += step;\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText +="    positionE += step_eye;\n";
                    }
                    shaderText +=
                    "    //break if the position is greater than <1, 1, 1>\n"+
                    "    if(pos.x > 1.0 || pos.y > 1.0 || pos.z > 1.0 || accum.a>=1.0)\n"+
                    "      break;\n"+
                    "  }\n"+
                    "  gl_FragColor = accum;\n"+
                    "}";

                    this.vrcFrontCubeShaderFragment._vf.url[0] = shaderText;

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderVertex, 'parts');
                    this.vrcFrontCubeShaderVertex.nodeChanged();
                    
                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFragment, 'parts');
                    this.vrcFrontCubeShaderFragment.nodeChanged();
                    
                    this.vrcFrontCubeShaderFieldBackCoord._vf.name = 'uBackCoord';
                    this.vrcFrontCubeShaderFieldBackCoord._vf.type = 'SFInt32';
                    this.vrcFrontCubeShaderFieldBackCoord._vf.value = 0;

                    this.vrcFrontCubeShaderFieldVolData._vf.name = 'uVolData';
                    this.vrcFrontCubeShaderFieldVolData._vf.type = 'SFInt32';
                    this.vrcFrontCubeShaderFieldVolData._vf.value = 1;

                    this.vrcFrontCubeShaderFieldOffset._vf.name = 'offset';
                    this.vrcFrontCubeShaderFieldOffset._vf.type = 'SFVec3f';
                    this.vrcFrontCubeShaderFieldOffset._vf.value = "0.01 0.01 0.01"; //Default initial value

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldBackCoord, 'fields');
                    this.vrcFrontCubeShaderFieldBackCoord.nodeChanged();
                    
                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldVolData, 'fields');
                    this.vrcFrontCubeShaderFieldVolData.nodeChanged();

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldOffset, 'fields');
 
                    //Take volume texture size for the ComposableRenderStyles offset parameter
                    this.offsetInterval = window.setInterval((function(aTex) {
                        return function() {
                            x3dom.debug.logInfo('[VolumeRendering][ISOSurfaceVolumeData] Looking for Volume Texture size...');
                            var s = that.getTextureSize(aTex);
                            if(s.valid){
                                clearInterval(that.offsetInterval);
                                that.vrcFrontCubeShaderFieldOffset._vf.value = new x3dom.fields.SFVec3f(1.0/s.w, 1.0/s.h, 1.0/aTex._vf.numberOfSlices);
                                that.vrcFrontCubeShader.nodeChanged();
                                x3dom.debug.logInfo('[VolumeRendering][ISOSurfaceVolumeData] Volume Texture size obtained');
                            }
                        }
                    })(this.vrcVolumeTexture), 1000);
                    
                    var ShaderUniforms = this.uniforms();
                    for (i = 0; i<ShaderUniforms.length; i++)
                    {
                        this.vrcFrontCubeShader.addChild(ShaderUniforms[i], 'fields');
                    }
                
                    this._cf.appearance.node.addChild(this.vrcFrontCubeShader);
                    this.vrcFrontCubeShader.nodeChanged();
                    
                    this._cf.appearance.node.nodeChanged();
                }

                if (!this._cf.geometry.node) {
                    this.addChild(new x3dom.nodeTypes.Box());

                    this._cf.geometry.node._vf.hasHelperColors = true;
                    this._cf.geometry.node._vf.size = new x3dom.fields.SFVec3f(
                        this._vf.dimensions.x, this._vf.dimensions.y, this._vf.dimensions.z);

                    // workaround to trigger field change...
                    this._cf.geometry.node.fieldChanged("hasHelperColors");
                    this._cf.geometry.node.fieldChanged("size");
                }
            }
        }
    )
);

/* ### MPRVolumeStyle ### */
x3dom.registerNodeType(
     "MPRVolumeStyle",
     "VolumeRendering",
     defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
         function (ctx) {
            x3dom.nodeTypes.MPRVolumeStyle.superClass.call(this, ctx);
            
            this.addField_SFVec3f(ctx, 'originLine', 1.0, 1.0, 0.0);
            this.addField_SFVec3f(ctx, 'finalLine', 0.0, 1.0, 0.0);
            this.addField_SFFloat(ctx, 'positionLine', 0.2);
            
            this.uniformVec3fOriginLine = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformVec3fFinalLine = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatPosition = new x3dom.nodeTypes.Uniform(ctx);
         },
         {
            fieldChanged: function(fieldName) {
                 switch(fieldName){
                    case 'positionLine':
                        this.uniformFloatPosition._vf.value = this._vf.positionLine;
                        this.uniformFloatPosition.fieldChanged("value");
                        break;
                    case 'originLine':
                        this.uniformVec3fOriginLine._vf.value = this._vf.originLine;
                        this.uniformVec3fOriginLine.fieldChanged("value");
                        break;
                    case 'finalLine':
                        this.uniformVec3fFinalLine._vf.value = this._vf.finalLine;
                        this.uniformVec3fFinalLine.fieldChanged("value");
                        break;
                }
            },

            uniforms: function() {
                var unis = [];

                this.uniformVec3fOriginLine._vf.name = 'originLine';
                this.uniformVec3fOriginLine._vf.type = 'SFVec3f';
                this.uniformVec3fOriginLine._vf.value = this._vf.originLine.toString();
                unis.push(this.uniformVec3fOriginLine);

                this.uniformVec3fFinalLine._vf.name = 'finalLine';
                this.uniformVec3fFinalLine._vf.type = 'SFVec3f';
                this.uniformVec3fFinalLine._vf.value = this._vf.finalLine.toString();
                unis.push(this.uniformVec3fFinalLine);

                this.uniformFloatPosition._vf.name = 'positionLine';
                this.uniformFloatPosition._vf.type = 'SFFloat';
                this.uniformFloatPosition._vf.value = this._vf.positionLine;
                unis.push(this.uniformFloatPosition);
  
                return unis;
            },

            styleUniformsShaderText: function(){
                return "uniform vec3 originLine;\nuniform vec3 finalLine;\nuniform float positionLine;\n";
            },

            fragmentShaderText : function (numberOfSlices, slicesOverX, slicesOverY) {
                var shader = 
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.texture3DFunctionShaderText+
                "void main()\n"+
                "{\n"+
                "  vec2 texC = vertexPosition.xy/vertexPosition.w;\n"+
                "  texC = 0.5*texC + 0.5;\n"+
                "  vec4 backColor = texture2D(uBackCoord,texC);\n"+
                "  vec3 dir =  backColor.xyz -vertexColor.xyz;\n"+
                "  vec3 normalPlane = finalLine-originLine;\n"+
                "  vec3 pointLine = normalPlane*positionLine+originLine;\n"+
                "  float d = dot(pointLine-vertexColor.xyz,normalPlane)/dot(dir,normalPlane);\n"+
                "  vec4 color = vec4(0.0,0.0,0.0,0.0);\n"+
                "  vec3 pos = d*dir+vertexColor.rgb;\n"+
                "  if (!(pos.x > 1.0 || pos.y > 1.0 || pos.z > 1.0 || pos.x<0.0 || pos.y<0.0 || pos.z<0.0)){\n"+
                "    color = vec4(cTexture3D(uVolData,pos.rgb,numberOfSlices,slicesOverX,slicesOverY).rgb,1.0);\n"+
                "  }\n"+
                "  gl_FragColor = color;\n"+
                "}";
                return shader;
            }
         }
    )
);

/* ### OpacityMapVolumeStyle ### */
x3dom.registerNodeType(
    "OpacityMapVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.OpacityMapVolumeStyle.superClass.call(this, ctx);

            this.addField_SFNode('transferFunction', x3dom.nodeTypes.Texture);
            this.addField_SFString(ctx, 'type', "simple");
            this.addField_SFFloat(ctx, 'opacityFactor', 6.0);
            this.addField_SFFloat(ctx, 'lightFactor', 1.2);

            this.uniformFloatOpacityFactor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatLightFactor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DTransferFunction = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolEnableOpacityMap = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'opacityFactor':
                        this.uniformFloatOpacityFactor._vf.value = this._vf.opacityFactor;
                        this.uniformFloatOpacityFactor.fieldChanged("value");
                        break;
                    case 'lightFactor':
                        this.uniformFloatLightFactor._vf.value = this._vf.lightFactor;
                        this.uniformFloatLightFactor.fieldChanged("value");
                        break;
                }
            },

            uniforms: function() {
                var unis = [];
                
                if (this._cf.transferFunction.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][OpacityMapVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }
                    this.uniformSampler2DTransferFunction._vf.name = 'uTransferFunction';
                    this.uniformSampler2DTransferFunction._vf.type = 'SFInt32';
                    this.uniformSampler2DTransferFunction._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DTransferFunction);
                }

                this.uniformFloatOpacityFactor._vf.name = 'uOpacityFactor';
                this.uniformFloatOpacityFactor._vf.type = 'SFFloat';
                this.uniformFloatOpacityFactor._vf.value = this._vf.opacityFactor;
                unis.push(this.uniformFloatOpacityFactor);

                this.uniformFloatLightFactor._vf.name = 'uLightFactor';
                this.uniformFloatLightFactor._vf.type = 'SFFloat';
                this.uniformFloatLightFactor._vf.value = this._vf.lightFactor;
                unis.push(this.uniformFloatLightFactor);

                this.uniformBoolEnableOpacityMap._vf.name = 'uEnableOpacityMap';
                this.uniformBoolEnableOpacityMap._vf.type = 'SFBool';
                this.uniformBoolEnableOpacityMap._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEnableOpacityMap);

                return unis;
            },

            textures: function() {
                var texs = [];
                var tex = this._cf.transferFunction.node;
                if (tex) {
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }
                return texs;
            },

            styleUniformsShaderText: function() {
                var uniformsText = "uniform float uOpacityFactor;\n"+
                "uniform float uLightFactor;\n"+
                "uniform bool uEnableOpacityMap;\n";
                if (this._cf.transferFunction.node) {
                        uniformsText += "uniform sampler2D uTransferFunction;\n";
                }
                return uniformsText;
            },

            inlineStyleShaderText: function(){
                var shaderText = "    if(uEnableOpacityMap){\n"+
                "       opacityFactor = uOpacityFactor;\n"+
                "       lightFactor = uLightFactor;\n";
                if (this._cf.transferFunction.node){
                        shaderText += "     value = texture2D(uTransferFunction,vec2(value.r,0.5));\n";
                }
                shaderText += "    }\n";
                return shaderText;
            },

            lightAssigment: function(){
                var inlineText = "  if(uEnableOpacityMap){\n"+
                    "         value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n"+
                    "   }\n";
                return inlineText;
            },

            fragmentShaderText : function (numberOfSlices, slicesOverX, slicesOverY) {
                var shader = 
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### ProjectionVolumeStyle ### */
x3dom.registerNodeType(
    "ProjectionVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.ProjectionVolumeStyle.superClass.call(this, ctx);

            this.addField_SFFloat(ctx, 'intensityThreshold', 0);
            this.addField_SFString(ctx, 'type', "MAX");

            this.uniformIntensityThreshold = new x3dom.nodeTypes.Uniform(ctx);
            //this.uniformType = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                if (fieldName === 'intensityThreshold') {
                    this.uniformIntensityThreshold._vf.value = this._vf.intensityThreshold;
                    this.uniformIntensityThreshold.fieldChanged("value");
                }else if(fieldName === 'type'){
                    //TODO: Reload node
                }
            },

            uniforms: function(){
                var unis = [];
                //var type_map = {'max':0,'min':1,'average':2};

                this.uniformIntensityThreshold._vf.name = 'uIntensityThreshold';
                this.uniformIntensityThreshold._vf.type = 'SFFloat';
                this.uniformIntensityThreshold._vf.value = this._vf.intensityThreshold;
                unis.push(this.uniformIntensityThreshold);

                /*this.uniformType._vf.name = 'uType';
                this.uniformType._vf.type = 'SFInt32';
                this.uniformType._vf.value = type_map[this._vf.type.toLowerCase()];
                unis.push(this.uniformType);*/

                return unis;
            },

            styleUniformsShaderText: function(){
                return "uniform int uType;\nuniform float uIntensityThreshold;\n";
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader = 
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.texture3DFunctionShaderText+
                "void main()\n"+
                "{\n"+
                "  vec2 texC = vertexPosition.xy/vertexPosition.w;\n"+
                "  texC = 0.5*texC + 0.5;\n"+
                "  vec4 backColor = texture2D(uBackCoord,texC);\n"+
                "  vec3 dir = backColor.rgb - vertexColor.rgb;\n"+
                "  vec3 pos = vertexColor;\n"+
                "  vec4 accum  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                "  vec4 sample = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                "  vec4 value  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                "  vec4 color  = vec4(0.0);\n";
                if (this._vf.type.toLowerCase() === "max") {
                    shader += "vec2 previous_value = vec2(0.0);\n";
                }else {
                    shader += "vec2 previous_value = vec2(1.0);\n";
                }
                shader +=
                "  float cont = 0.0;\n"+
                "  vec3 step = dir/Steps;\n"+
                "  const float lightFactor = 1.3;\n"+
                "  const float opacityFactor = 3.0;\n"+
                "  for(float i = 0.0; i < Steps; i+=1.0)\n"+
                "  {\n"+
                "    value = cTexture3D(uVolData,pos,numberOfSlices,slicesOverX,slicesOverY);\n"+
                "    value = vec4(value.rgb,(0.299*value.r)+(0.587*value.g)+(0.114*value.b));\n"+
                "    //Process the volume sample\n"+
                "    sample.a = value.a * opacityFactor * (1.0/Steps);\n"+
                "    sample.rgb = value.rgb * sample.a * lightFactor;\n"+
                "    accum.a += (1.0-accum.a)*sample.a;\n";
                if(this._vf.enabled){
                    switch (this._vf.type.toLowerCase()) {
                    case "max":
                        shader += "if(value.r > uIntensityThreshold && value.r <= previous_value.x){\n"+
                        "   break;\n"+
                        "}\n"+
                        "color.rgb = vec3(max(value.r, previous_value.x));\n"+
                        "color.a = (value.r > previous_value.x) ? accum.a : previous_value.y;\n";
                        break;
                    case "min":
                        shader += "if(value.r < uIntensityThreshold && value.r >= previous_value.x){\n"+
                        "   break;\n"+
                        "}\n"+
                        "color.rgb = vec3(min(value.r, previous_value.x));\n"+
                        "color.a = (value.r < previous_value.x) ? accum.a : previous_value.y;\n";
                        break;
                    case "average":
                        shader+= "color.rgb += (1.0 - accum.a) * sample.rgb;\n"+
                        "color.a = accum.a;\n";
                        break;
                    }
                }
                shader += 
                "    //update the previous value and keeping the accumulated alpha\n"+
                "    previous_value.x = color.r;\n"+
                "    previous_value.y = accum.a;\n"+
                "    //advance the current position\n"+
                "    pos.xyz += step;\n"+
                "    //break if the position is greater than <1, 1, 1>\n"+
                "    if(pos.x > 1.0 || pos.y > 1.0 || pos.z > 1.0 || accum.a>=1.0){\n";
                if(this._vf.type.toLowerCase() == "average" && this._vf.enabled){
                    shader += "     if((i > 0.0) && (i < Steps-1.0)){\n"+
                    "color.rgb = color.rgb/i;\n"+
                    "}\n";
                }
                shader+=
                "      break;\n"+
                "    }\n"+
                " }\n"+
                " gl_FragColor = color;\n"+
                "}";
                return shader;
            }
        }
    )
);

/* ### SegmentedVolumeData ### */
x3dom.registerNodeType(
    "SegmentedVolumeData",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DVolumeDataNode,
        function (ctx) {
            x3dom.nodeTypes.SegmentedVolumeData.superClass.call(this, ctx);

            this.addField_MFNode('renderStyle', x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode);
            //this.addField_MFBool(ctx, 'segmentEnabled', []);  // MFBool NYI!!!
            //this.addField_SFNode('segmentIdentifiers', x3dom.nodeTypes.X3DVolumeDataNode);
            this.addField_SFNode('segmentIdentifiers', x3dom.nodeTypes.Texture);
            this.addField_SFFloat(ctx, 'numberOfMaxSegments', 10.0);

            this.uniformSampler2DSegmentIdentifiers = new x3dom.nodeTypes.Uniform(ctx);
            this.normalTextureProvided = false;

            this.vrcMultiTexture = new x3dom.nodeTypes.MultiTexture(ctx);
            this.vrcRenderTexture = new x3dom.nodeTypes.RenderedTexture(ctx);
            this.vrcVolumeTexture = null;

            this.vrcBackCubeShape = new x3dom.nodeTypes.Shape(ctx);
            this.vrcBackCubeAppearance = new x3dom.nodeTypes.Appearance();
            this.vrcBackCubeGeometry = new x3dom.nodeTypes.Box(ctx);
            this.vrcBackCubeShader = new x3dom.nodeTypes.ComposedShader(ctx);
            this.vrcBackCubeShaderVertex = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcBackCubeShaderFragment = new x3dom.nodeTypes.ShaderPart(ctx);

            this.vrcFrontCubeShader = new x3dom.nodeTypes.ComposedShader(ctx);
            this.vrcFrontCubeShaderVertex = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcFrontCubeShaderFragment = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcFrontCubeShaderFieldBackCoord = new x3dom.nodeTypes.Field(ctx);
            this.vrcFrontCubeShaderFieldVolData = new x3dom.nodeTypes.Field(ctx);
            this.vrcFrontCubeShaderFieldOffset = new x3dom.nodeTypes.Field(ctx);
        },
        {
            fieldChanged: function(fieldName){
                if (fieldName === "numberOfMaxSegments" || fieldname === "segmentIdentifiers") {
                    //TODO: Reload node   
                }
            },

            uniforms: function(){
                var unis = [];

                if (this._cf.segmentIdentifiers.node) {
                    this.uniformSampler2DSegmentIdentifiers._vf.name = 'uSegmentIdentifiers';
                    this.uniformSampler2DSegmentIdentifiers._vf.type = 'SFInt32';
                    this.uniformSampler2DSegmentIdentifiers._vf.value = this._textureID++;
                    unis.push(this.uniformSampler2DSegmentIdentifiers);
                }

                //Also add the render style uniforms
                if (this._cf.renderStyle.nodes) {
                    var i, n = this._cf.renderStyle.nodes.length;
                    for (i=0; i<n; i++){
                        //Not repeat common uniforms, TODO: Allow multiple surface normals
                        var that = this;
                        Array.forEach(this._cf.renderStyle.nodes[i].uniforms(), function(uniform){
                            var contains_uniform = false;
                            Array.forEach(unis, function(accum){
                                if(accum._vf.name == uniform._vf.name){
                                    contains_uniform = true;
                                }
                            });
                            if (contains_uniform == false){
                                unis = unis.concat(uniform);
                            }
                        });
                    }    
                }
                return unis;
            },

            textures: function(){
                var texs = [];
                if(this._cf.segmentIdentifiers.node){
                    var tex = this._cf.segmentIdentifiers.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex);
                }

                //Also add the render style textures
                var i, n = this._cf.renderStyle.nodes.length;
                for (i=0; i<n; i++){
                    //Not repeat same textures, TODO: Allow multiply surface normals textures
                    Array.forEach(this._cf.renderStyle.nodes[i].textures(), function(texture){
                        var contains_texture = false;
                        Array.forEach(texs, function(accum){
                            if(accum._vf.url[0] == texture._vf.url[0]){
                                contains_texture = true;
                            }
                        });
                        if (contains_texture == false){
                            texs = texs.concat(texture);
                        }
                    });
                }
                return texs;
            },

            initializeValues: function() {
                var initialValues ="";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    if(this._cf.renderStyle.nodes[i].initializeValues != undefined){
                        initialValues += this._cf.renderStyle.nodes[i].initializeValues() + "\n";
                    }
                }
                return initialValues;
            },

            styleUniformsShaderText: function(){
                var styleText = "uniform sampler2D uSegmentIdentifiers;\n"; //TODO: Segment enabled
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    styleText += this._cf.renderStyle.nodes[i].styleUniformsShaderText() + "\n";
                    if(this._cf.renderStyle.nodes[i]._cf.surfaceNormals && this._cf.renderStyle.nodes[i]._cf.surfaceNormals.node != null){
                        this.normalTextureProvided = true;
                        this.surfaceNormals = this._cf.renderStyle.nodes[i]._cf.surfaceNormals.node;
                    }
                }
                return styleText;
            },

            styleShaderText: function(){
                var styleText = "";
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){
                    if(this._cf.renderStyle.nodes[i].styleShaderText != undefined){
                        styleText += this._cf.renderStyle.nodes[i].styleShaderText()+"\n";
                    }
                }
                return styleText;
            },

            inlineStyleShaderText: function(){
                var inlineText = "";
                if(this._cf.segmentIdentifiers.node){
                    inlineText += "float t_id = cTexture3D(uSegmentIdentifiers, pos, numberOfSlices, slicesOverX, slicesOverY).r;\n"+
                    "int s_id = int(floor((t_id-offset_s)*maxSegments));\n";
                }else{
                    inlineText += "int s_id = 0;\n";
                }
                //TODO Check if the segment identifier is going to be rendered or not. NYI!!
                var n = this._cf.renderStyle.nodes.length;
                for (var i=0; i<n; i++){ //TODO Check identifier and add the style
                    inlineText += "if (s_id == "+i+"){\n"+
                    this._cf.renderStyle.nodes[i].inlineStyleShaderText()+
                    "}\n";
                }
                return inlineText;
            },

            lightAssigment: function(){
                var isBlendedStyle = false;
                //Check if there is a blendedStyle, not to use lightAssigment
                Array.forEach(this._cf.renderStyle.nodes, function(style){
                    if(x3dom.isa(style, x3dom.nodeTypes.BlendedVolumeStyle)){
                        isBlendedStyle = true;
                    }
                });
                if(!isBlendedStyle){
                    return this._cf.renderStyle.nodes[0].lightAssigment();
                }else{
                    return "";
                }
            },

            lightEquationShaderText: function(){ //TODO: ligth equation per segment
                return this._cf.renderStyle.nodes[0].lightEquationShaderText();
            },

            nodeChanged: function()
            {
                if (!this._cf.appearance.node) 
                {
                    var that = this;
                    var i;

                    this.addChild(x3dom.nodeTypes.Appearance.defaultNode());
                    
                    // second texture, ray direction and length
                    this.vrcBackCubeShaderVertex._vf.type = 'vertex';
                    this.vrcBackCubeShaderVertex._vf.url[0] =
                        "attribute vec3 position;\n" +
                        "attribute vec3 color;\n" +
                        "varying vec3 fragColor;\n" +
                        "uniform mat4 modelViewProjectionMatrix;\n" +
                        "\n" +
                        "void main(void) {\n" +
                        "    fragColor = color;\n" +
                        "    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);\n" +
                        "}\n";

                    this.vrcBackCubeShaderFragment._vf.type = 'fragment';
                    this.vrcBackCubeShaderFragment._vf.url[0] =
                        "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
                        "  precision highp float;\n" +
                        "#else\n" +
                        "  precision mediump float;\n" +
                        "#endif\n" +
                        "\n" +
                        "varying vec3 fragColor;\n" +
                        "\n" +
                        "void main(void) {\n" +
                        "    gl_FragColor = vec4(fragColor, 1.0);\n" +
                        "}\n";
                    
                    this.vrcBackCubeShader.addChild(this.vrcBackCubeShaderFragment, 'parts');
                    this.vrcBackCubeShaderFragment.nodeChanged();
                    
                    this.vrcBackCubeShader.addChild(this.vrcBackCubeShaderVertex, 'parts');
                    this.vrcBackCubeShaderVertex.nodeChanged();
                    
                    this.vrcBackCubeAppearance.addChild(this.vrcBackCubeShader);
                    this.vrcBackCubeShader.nodeChanged();
                    
                    // initialize fbo - note that internally the datatypes must fit!
                    this.vrcRenderTexture._vf.update = 'always';
                    this.vrcRenderTexture._vf.dimensions = [500, 500, 4];
                    this.vrcRenderTexture._vf.repeatS = false;
                    this.vrcRenderTexture._vf.repeatT = false;
                    this.vrcRenderTexture._nameSpace = this._nameSpace;
                    this._textureID++;

                    this.vrcBackCubeGeometry._vf.size = new x3dom.fields.SFVec3f(
                        this._vf.dimensions.x, this._vf.dimensions.y, this._vf.dimensions.z);
                    this.vrcBackCubeGeometry._vf.ccw = false;
                    this.vrcBackCubeGeometry._vf.solid = true;
                    // manually trigger size update
                    this.vrcBackCubeGeometry.fieldChanged("size");
                    
                    this.vrcBackCubeShape.addChild(this.vrcBackCubeGeometry);
                    this.vrcBackCubeGeometry.nodeChanged();
                    
                    this.vrcBackCubeShape.addChild(this.vrcBackCubeAppearance);
                    this.vrcBackCubeAppearance.nodeChanged();
                    
                    this.vrcRenderTexture.addChild(this.vrcBackCubeShape, 'scene');
                    this.vrcBackCubeShape.nodeChanged();
                    
                    // create shortcut to volume data set
                    this.vrcVolumeTexture = this._cf.voxels.node;
                    this.vrcVolumeTexture._vf.repeatS = false;
                    this.vrcVolumeTexture._vf.repeatT = false;
                    this._textureID++;

                    this.vrcMultiTexture._nameSpace = this._nameSpace;
                    
                    this.vrcMultiTexture.addChild(this.vrcRenderTexture, 'texture');
                    this.vrcRenderTexture.nodeChanged();
                    
                    this.vrcMultiTexture.addChild(this.vrcVolumeTexture, 'texture');
                    this.vrcVolumeTexture.nodeChanged();
                    
                    // textures from styles
                    var styleTextures = this.textures();
                    for (i = 0; i<styleTextures.length; i++)
                    {
                        this.vrcMultiTexture.addChild(styleTextures[i], 'texture');
                        this.vrcVolumeTexture.nodeChanged();
                    }
                    
                    this._cf.appearance.node.addChild(this.vrcMultiTexture);
                    this.vrcMultiTexture.nodeChanged();
                    
                    // here goes the volume shader
                    this.vrcFrontCubeShaderVertex._vf.type = 'vertex';
                    var shaderText=
                    "attribute vec3 position;\n"+
                    "attribute vec3 color;\n"+
                    "uniform mat4 modelViewProjectionMatrix;\n"+
                    "varying vec3 vertexColor;\n"+
                    "varying vec4 vertexPosition;\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText += "uniform mat4 modelViewMatrix;\n"+
                        "varying vec4 position_eye;\n";
                    }
                    shaderText += "\n" +
                    "void main()\n"+
                    "{\n"+
                    "  vertexColor = color;\n"+
                    "  vertexPosition = modelViewProjectionMatrix * vec4(position, 1.0);\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                       shaderText += "  position_eye = modelViewMatrix * vec4(position, 1.0);\n";
                    }
                    shaderText += 
                    "  gl_Position = vertexPosition;\n"+
                    "}";
                    this.vrcFrontCubeShaderVertex._vf.url[0] = shaderText;

                    this.vrcFrontCubeShaderFragment._vf.type = 'fragment';
                    shaderText =
                    "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
                    "  precision highp float;\n" +
                    "#else\n" +
                    "  precision mediump float;\n" +
                    "#endif\n\n"+
                    "uniform sampler2D uBackCoord;\n"+
                    "uniform sampler2D uVolData;\n"+
                    "uniform vec3 offset;\n"+
                    "uniform mat4 modelViewMatrixInverse;\n"+
                    "uniform sampler2D uSurfaceNormals;\n"+
                    "varying vec3 vertexColor;\n"+
                    "varying vec4 vertexPosition;\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText += "varying vec4 position_eye;\n";
                    }
                    shaderText +=
                    "const float Steps = 60.0;\n"+
                    "const float numberOfSlices = "+ this.vrcVolumeTexture._vf.numberOfSlices.toPrecision(5)+";\n"+
                    "const float slicesOverX = " + this.vrcVolumeTexture._vf.slicesOverX.toPrecision(5) +";\n"+
                    "const float slicesOverY = " + this.vrcVolumeTexture._vf.slicesOverY.toPrecision(5) +";\n"+
                    "const float maxSegments = " + this._vf.numberOfMaxSegments.toPrecision(3) + ";\n";
                    //LIGHTS
                    var n_lights = x3dom.nodeTypes.X3DLightNode.lightID;
                    for(var l=0; l<n_lights; l++) {
                        shaderText +=   "uniform float light"+l+"_On;\n" +
                        "uniform float light"+l+"_Type;\n" +
                        "uniform vec3  light"+l+"_Location;\n" +
                        "uniform vec3  light"+l+"_Direction;\n" +
                        "uniform vec3  light"+l+"_Color;\n" +
                        "uniform vec3  light"+l+"_Attenuation;\n" +
                        "uniform float light"+l+"_Radius;\n" +
                        "uniform float light"+l+"_Intensity;\n" +
                        "uniform float light"+l+"_AmbientIntensity;\n" +
                        "uniform float light"+l+"_BeamWidth;\n" +
                        "uniform float light"+l+"_CutOffAngle;\n" +
                        "uniform float light"+l+"_ShadowIntensity;\n";
                    }
                    shaderText += this.styleUniformsShaderText()+
                    this.styleShaderText()+
                    "vec4 cTexture3D(sampler2D vol, vec3 volpos, float nS, float nX, float nY)\n"+
                    "{\n"+
                    "  float s1,s2;\n"+
                    "  float dx1,dy1;\n"+
                    "  float dx2,dy2;\n"+
                    "  vec2 texpos1,texpos2;\n"+
                    "  s1 = floor(volpos.z*nS);\n"+
                    "  s2 = s1+1.0;\n"+
                    "  dx1 = fract(s1/nX);\n"+
                    "  dy1 = floor(s1/nY)/nY;\n"+
                    "  dx2 = fract(s2/nX);\n"+
                    "  dy2 = floor(s2/nY)/nY;\n"+
                    "  texpos1.x = dx1+(volpos.x/nX);\n"+
                    "  texpos1.y = dy1+(volpos.y/nY);\n"+
                    "  texpos2.x = dx2+(volpos.x/nX);\n"+
                    "  texpos2.y = dy2+(volpos.y/nY);\n"+
                    "  return mix( texture2D(vol,texpos1), texture2D(vol,texpos2), (volpos.z*nS)-s1);\n"+
                    "}\n"+
                    "\n"+
                    "vec4 getNormalFromTexture(sampler2D sampler, vec3 pos, float nS, float nX, float nY) {\n"+
                    "   vec4 n = (2.0*cTexture3D(sampler, pos, nS, nX, nY)-1.0);\n"+
                    "   n.a = length(n.xyz);\n"+
                    "   n.xyz = normalize(n.xyz);\n"+
                    "   return n;\n"+
                    "}\n"+
                    "\n"+
                    "vec4 getNormalOnTheFly(sampler2D sampler, vec3 voxPos, float nS, float nX, float nY){\n"+
                    "   float v0 = cTexture3D(sampler, voxPos + vec3(offset.x, 0, 0), nS, nX, nY).r;\n"+
                    "   float v1 = cTexture3D(sampler, voxPos - vec3(offset.x, 0, 0), nS, nX, nY).r;\n"+
                    "   float v2 = cTexture3D(sampler, voxPos + vec3(0, offset.y, 0), nS, nX, nY).r;\n"+
                    "   float v3 = cTexture3D(sampler, voxPos - vec3(0, offset.y, 0), nS, nX, nY).r;\n"+
                    "   float v4 = cTexture3D(sampler, voxPos + vec3(0, 0, offset.z), nS, nX, nY).r;\n"+
                    "   float v5 = cTexture3D(sampler, voxPos - vec3(0, 0, offset.z), nS, nX, nY).r;\n"+
                    "   vec3 grad = vec3((v0-v1)/2.0, (v2-v3)/2.0, (v4-v5)/2.0);\n"+
                    "   return vec4(normalize(grad), length(grad));\n"+
                    "}\n"+
                    "\n"+
                    this.lightEquationShaderText();
                    shaderText += "void main()\n"+
                    "{\n"+
                    "  vec2 texC = vertexPosition.xy/vertexPosition.w;\n"+
                    "  texC = 0.5*texC + 0.5;\n"+
                    "  vec4 backColor = texture2D(uBackCoord,texC);\n"+
                    "  vec3 dir = backColor.rgb - vertexColor.rgb;\n"+
                    "  vec3 pos = vertexColor;\n"+
                    "  vec4 accum  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                    "  vec4 sample = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                    "  vec4 value  = vec4(0.0, 0.0, 0.0, 0.0);\n"+
                    "  float offset_s = 1.0/(2.0*maxSegments);\n"+
                    "  float cont = 0.0;\n"+
                    "  vec3 step = dir/Steps;\n";
                    //Light init values
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText +=
                        "  vec3 ambient = vec3(0.0, 0.0, 0.0);\n"+
                        "  vec3 diffuse = vec3(0.0, 0.0, 0.0);\n"+
                        "  vec3 specular = vec3(0.0, 0.0, 0.0);\n"+
                        "  vec4 step_eye = modelViewMatrix * vec4(step, 0.0);\n"+
                        "  vec4 positionE = position_eye;\n"+
                        "  float lightFactor = 1.0;\n"; 
                    }else{
                        shaderText += "  float lightFactor = 1.2;\n";
                    }
                    shaderText += this.initializeValues()+
                    "  float opacityFactor = 6.0;\n"+
                    "  for(float i = 0.0; i < Steps; i+=1.0)\n"+
                    "  {\n"+
                    "    value = cTexture3D(uVolData, pos, numberOfSlices, slicesOverX, slicesOverY);\n"+
                    "    value = vec4(value.rgb,(0.299*value.r)+(0.587*value.g)+(0.114*value.b));\n";
                    if(this.normalTextureProvided){
                        shaderText += "    vec4 gradEye = getNormalFromTexture(uSurfaceNormals, pos, numberOfSlices, slicesOverX, slicesOverY);\n";
                    }else{
                        shaderText += "    vec4 gradEye = getNormalOnTheFly(uVolData, pos, numberOfSlices, slicesOverX, slicesOverY);\n";
                    }
                    shaderText += "    vec4 grad = vec4((modelViewMatrixInverse * vec4(gradEye.xyz, 0.0)).xyz, gradEye.a);\n";
                    for(var l=0; l<x3dom.nodeTypes.X3DLightNode.lightID; l++) {
                        shaderText +="    lighting(light"+l+"_Type, " +
                        "light"+l+"_Location, " +
                        "light"+l+"_Direction, " +
                        "light"+l+"_Color, " + 
                        "light"+l+"_Attenuation, " +
                        "light"+l+"_Radius, " +
                        "light"+l+"_Intensity, " + 
                        "light"+l+"_AmbientIntensity, " +
                        "light"+l+"_BeamWidth, " +
                        "light"+l+"_CutOffAngle, " +
                        "grad.xyz, -positionE.xyz, ambient, diffuse, specular);\n";
                    }
                    shaderText += this.inlineStyleShaderText();
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderText += this.inlineLightAssigment();
                    }
                    shaderText +=
                    "    //Process the volume sample\n"+
                    "    sample.a = value.a * opacityFactor * (1.0/Steps);\n"+
                    "    sample.rgb = value.rgb * sample.a * lightFactor ;\n"+
                    "    accum.rgb += (1.0 - accum.a) * sample.rgb;\n"+
                    "    accum.a += (1.0 - accum.a) * sample.a;\n"+
                    "    //advance the current position\n"+
                    "    pos.xyz += step;\n";
                    if(x3dom.nodeTypes.X3DLightNode.lightID>0){
                        shaderLoop +="    positionE += step_eye;\n";
                    }
                    shaderText +=
                    "    //break if the position is greater than <1, 1, 1>\n"+
                    "    if(pos.x > 1.0 || pos.y > 1.0 || pos.z > 1.0 || accum.a>=1.0)\n"+
                    "      break;\n"+
                    "  }\n"+
                    "  gl_FragColor = accum;\n"+
                    "}";

                    this.vrcFrontCubeShaderFragment._vf.url[0] = shaderText;

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderVertex, 'parts');
                    this.vrcFrontCubeShaderVertex.nodeChanged();
                    
                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFragment, 'parts');
                    this.vrcFrontCubeShaderFragment.nodeChanged();
                    
                    this.vrcFrontCubeShaderFieldBackCoord._vf.name = 'uBackCoord';
                    this.vrcFrontCubeShaderFieldBackCoord._vf.type = 'SFInt32';
                    this.vrcFrontCubeShaderFieldBackCoord._vf.value = 0;

                    this.vrcFrontCubeShaderFieldVolData._vf.name = 'uVolData';
                    this.vrcFrontCubeShaderFieldVolData._vf.type = 'SFInt32';
                    this.vrcFrontCubeShaderFieldVolData._vf.value = 1;

                    this.vrcFrontCubeShaderFieldOffset._vf.name = 'offset';
                    this.vrcFrontCubeShaderFieldOffset._vf.type = 'SFVec3f';
                    this.vrcFrontCubeShaderFieldOffset._vf.value = "0.01 0.01 0.01"; //Default initial value

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldBackCoord, 'fields');
                    this.vrcFrontCubeShaderFieldBackCoord.nodeChanged();
                    
                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldVolData, 'fields');
                    this.vrcFrontCubeShaderFieldVolData.nodeChanged();

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldOffset, 'fields');
 
                    //Take volume texture size for the ComposableRenderStyles offset parameter
                    this.offsetInterval = window.setInterval((function(aTex) {
                        return function() {
                            x3dom.debug.logInfo('[VolumeRendering][SegmentedVolumeData] Looking for Volume Texture size...');
                            var s = that.getTextureSize(aTex);
                            if(s.valid){
                                clearInterval(that.offsetInterval);
                                that.vrcFrontCubeShaderFieldOffset._vf.value = new x3dom.fields.SFVec3f(1.0/s.w, 1.0/s.h, 1.0/aTex._vf.numberOfSlices);
                                that.vrcFrontCubeShader.nodeChanged();
                                x3dom.debug.logInfo('[VolumeRendering][SegmentedVolumeData] Volume Texture size obtained');
                            }
                        }
                    })(this.vrcVolumeTexture), 1000);
                    
                    var ShaderUniforms = this.uniforms();
                    for (i = 0; i<ShaderUniforms.length; i++)
                    {
                        this.vrcFrontCubeShader.addChild(ShaderUniforms[i], 'fields');
                    }
                
                    this._cf.appearance.node.addChild(this.vrcFrontCubeShader);
                    this.vrcFrontCubeShader.nodeChanged();
                    
                    this._cf.appearance.node.nodeChanged();
                }

                if (!this._cf.geometry.node) {
                    this.addChild(new x3dom.nodeTypes.Box());

                    this._cf.geometry.node._vf.hasHelperColors = true;
                    this._cf.geometry.node._vf.size = new x3dom.fields.SFVec3f(
                        this._vf.dimensions.x, this._vf.dimensions.y, this._vf.dimensions.z);

                    // workaround to trigger field change...
                    this._cf.geometry.node.fieldChanged("hasHelperColors");
                    this._cf.geometry.node.fieldChanged("size");
                }
            }
        }
    )
);

/* ### ShadedVolumeStyle ### */
x3dom.registerNodeType(
    "ShadedVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.ShadedVolumeStyle.superClass.call(this, ctx);

            this.addField_SFNode('material', x3dom.nodeTypes.X3DMaterialNode);
            this.addField_SFBool(ctx, 'lighting', false);
            this.addField_SFBool(ctx, 'shadows', false);
            this.addField_SFString(ctx, 'phaseFunction', "Henyey-Greenstein");

            this.uniformBoolLigthning = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolShadows = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DSurfaceNormals = new x3dom.nodeTypes.Uniform(ctx);
            //Material uniforms
            this.uniformColorSpecular = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatAmbientIntensity = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatShininess = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatTransparency = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformColorEmissive = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformColorDiffuse = new x3dom.nodeTypes.Uniform(ctx);
            //Enable/Disable style
            this.uniformBoolEnableShaded = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'lightning':
                        this.uniformBoolLightning._vf.value = this._vf.lightning;
                        this.uniformBoolLightning.fieldChanged("value");
                        break;
                    case 'shadows':
                        this.uniformBoolShadows._vf.value = this._vf.shadows;
                        this.uniformBoolShadows.fieldChanged("value");
                        break;
                    default:
                        //TODO: Reload node
                        break;
                }
            },

            uniforms: function(){
                var unis = [];
                if (this._cf.surfaceNormals.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][ShadedVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }
                    this.uniformSampler2DSurfaceNormals._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DSurfaceNormals._vf.type = 'SFInt32';
                    this.uniformSampler2DSurfaceNormals._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DSurfaceNormals);
                }

                this.uniformBoolLigthning._vf.name = 'uLightning';
                this.uniformBoolLigthning._vf.type = 'SFBool';
                this.uniformBoolLigthning._vf.value = this._vf.lighting;
                unis.push(this.uniformBoolLigthning);

                this.uniformBoolShadows._vf.name = 'uShadows';
                this.uniformBoolShadows._vf.type = 'SFBool';
                this.uniformBoolShadows._vf.value = this._vf.shadows;
                unis.push(this.uniformBoolShadows);

                //Material uniform parameters
                if(this._cf.material.node != null){
                    this.uniformColorSpecular._vf.name = 'specularColor';
                    this.uniformColorSpecular._vf.type = 'SFColor';
                    this.uniformColorSpecular._vf.value = this._cf.material.node._vf.specularColor;
                    unis.push(this.uniformColorSpecular);

                    this.uniformColorDiffuse._vf.name = 'diffuseColor';
                    this.uniformColorDiffuse._vf.type = 'SFColor';
                    this.uniformColorDiffuse._vf.value = this._cf.material.node._vf.diffuseColor;
                    unis.push(this.uniformColorDiffuse);

                    this.uniformColorEmissive._vf.name = 'emissiveColor';
                    this.uniformColorEmissive._vf.type = 'SFColor';
                    this.uniformColorEmissive._vf.value = this._cf.material.node._vf.emissiveColor;
                    unis.push(this.uniformColorEmissive);

                    this.uniformFloatAmbientIntensity._vf.name = 'ambientIntensity';
                    this.uniformFloatAmbientIntensity._vf.type = 'SFFloat';
                    this.uniformFloatAmbientIntensity._vf.value = this._cf.material.node._vf.ambientIntensity;
                    unis.push(this.uniformFloatAmbientIntensity);

                    this.uniformFloatShininess._vf.name = 'shininess';
                    this.uniformFloatShininess._vf.type = 'SFFloat';
                    this.uniformFloatShininess._vf.value = this._cf.material.node._vf.shininess;
                    unis.push(this.uniformFloatShininess);

                    this.uniformFloatTransparency._vf.name = 'transparency';
                    this.uniformFloatTransparency._vf.type = 'SFFloat';
                    this.uniformFloatTransparency._vf.value = this._cf.material.node._vf.transperency;
                    unis.push(this.uniformFloatTransparency);
                }

                this.uniformBoolEnableShaded._vf.name = 'uEnableShaded';
                this.uniformBoolEnableShaded._vf.type = 'SFBool';
                this.uniformBoolEnableShaded._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEnableShaded);

                return unis;
            },

            textures: function() {
                var texs = [];
                if (this._cf.surfaceNormals.node) {
                    var tex = this._cf.surfaceNormals.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex)
                }
                return texs;
            },

            styleUniformsShaderText: function(){
                var uniformText = "uniform bool uLightning;\n"+
                "uniform bool uShadows;\n"+
                //Fog uniforms
                "uniform float fogRange;\n"+
                "uniform vec3 fogColor;\n"+
                "uniform float fogType;\n"+
                "uniform bool uEnableShaded;\n";
                //Material uniforms
                if(this._cf.material.node){
                    uniformText += "uniform vec3  diffuseColor;\n" +
                    "uniform vec3  specularColor;\n" +
                    "uniform vec3  emissiveColor;\n" +
                    "uniform float shininess;\n" +
                    "uniform float transparency;\n" +
                    "uniform float ambientIntensity;\n";
                }
                return uniformText;
            },

            styleShaderText: function(){
                var styleText = "float computeFogInterpolant(float distanceFromPoint)\n"+
                "{\n"+
                "  if (distanceFromPoint > fogRange){\n"+
                "    return 0.0;\n"+
                "  }else if (fogType == 0.0){\n"+
                "    return clamp((fogRange-distanceFromPoint) / fogRange, 0.0, 1.0);\n"+
                "  }else{\n"+
                "    return clamp(exp(-distanceFromPoint / (fogRange-distanceFromPoint)), 0.0, 1.0);\n"+
                "  }\n"+
                "}\n";
                return styleText;
            },

            lightEquationShaderText: function(){
                return "void lighting(in float lType, in vec3 lLocation, in vec3 lDirection, in vec3 lColor, in vec3 lAttenuation, " + 
                    "in float lRadius, in float lIntensity, in float lAmbientIntensity, in float lBeamWidth, " +
                    "in float lCutOffAngle, in vec3 N, in vec3 V, inout vec3 ambient, inout vec3 diffuse, " +
                    "inout vec3 specular)\n" +
                    "{\n" +
                    "   if(uEnableShaded){\n"+
                    "      vec3 L;\n" +
                    "      float spot = 1.0, attentuation = 0.0;\n" +
                    "       if(lType == 0.0) {\n" +
                    "           L = -normalize(lDirection);\n" +
                    "           V = normalize(V);\n" +
                    "           attentuation = 1.0;\n" +
                    "       } else{\n" +
                    "           L = (lLocation - (-V));\n" +
                    "           float d = length(L);\n" +
                    "           L = normalize(L);\n" +
                    "           V = normalize(V);\n" +
                    "           if(lRadius == 0.0 || d <= lRadius) {\n" +
                    "               attentuation = 1.0 / max(lAttenuation.x + lAttenuation.y * d + lAttenuation.z * (d * d), 1.0);\n" +
                    "           }\n" +
                    "           if(lType == 2.0) {\n" +
                    "               float spotAngle = acos(max(0.0, dot(-L, normalize(lDirection))));\n" +
                    "               if(spotAngle >= lCutOffAngle) spot = 0.0;\n" +
                    "               else if(spotAngle <= lBeamWidth) spot = 1.0;\n" +
                    "               else spot = (spotAngle - lCutOffAngle ) / (lBeamWidth - lCutOffAngle);\n" +
                    "           }\n" +
                    "       }\n" +
                    "       vec3 H = normalize( L + V );\n" +
                    "       float NdotL = max(0.0, dot(L, N));\n" +
                    "       float NdotH = max(0.0, dot(H, N));\n" +
                    "       float ambientFactor = lAmbientIntensity * ambientIntensity;\n" +
                    "       float diffuseFactor = lIntensity * NdotL;\n" +
                    "       float specularFactor = lIntensity * pow(NdotH, shininess*128.0);\n" +
                    "       ambient += lColor * ambientFactor * attentuation * spot;\n" +
                    "       diffuse += lColor * diffuseFactor * attentuation * spot;\n" +
                    "       specular += lColor * specularFactor * attentuation * spot;\n" +
                    "   }\n"+  
                    "}\n"
            },

            inlineStyleShaderText: function(){
                var inlineText = "    float fogFactor = 1.0;\n"+
                    "    if(uEnableShaded){\n"+
                    "       fogFactor = computeFogInterpolant(length(cam_pos-pos));\n"+
                    "    }\n";
                return inlineText;
            },

            lightAssigment: function(){
                var shaderText = "    if(uEnableShaded){\n";
                if(this._vf.lighting == true){
                    if(this._cf.material.node){
                        shaderText += "      value.rgb = (fogColor*(1.0-fogFactor))+fogFactor*(emissiveColor + ambient*value.rgb + diffuse*diffuseColor*value.rgb + specular*specularColor);\n"+
                        "      value.a = value.a*(1.0-transparency);\n";
                    }else{
                        shaderText += "      value.rgb = (fogColor*(1.0-fogFactor))+fogFactor*(ambient*value.rgb + diffuse*value.rgb + specular);\n";
                    }
                }
                shaderText += "    }\n";
                return shaderText;
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### SilhouetteEnhancementVolumeStyle ### */
x3dom.registerNodeType(
    "SilhouetteEnhancementVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.SilhouetteEnhancementVolumeStyle.superClass.call(this, ctx);

            this.addField_SFFloat(ctx, 'silhouetteBoundaryOpacity', 0);
            this.addField_SFFloat(ctx, 'silhouetteRetainedOpacity', 1);
            this.addField_SFFloat(ctx, 'silhouetteSharpness', 0.5);

            this.uniformFloatBoundaryOpacity = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatRetainedOpacity = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformFloatSilhouetteSharpness = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DSurfaceNormals = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolEnableSilhouette = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'silhouetteBoundaryOpacity':
                        this.uniformFloatBoundaryOpacity._vf.value = this._vf.silhouetteBoundaryOpacity;
                        this.uniformFloatBoundaryOpacity.fieldChanged("value");
                        break;
                    case 'silhouetteRetainedOpacity':
                        this.uniformFloatRetainedOpacity._vf.value = this._vf.silhouetteRetainedOpacity;
                        this.uniformFloatRetainedOpacity.fieldChanged("value");
                        break;
                    case 'silhouetteSharpness':
                        this.uniformFloatSilhouetteSharpness._vf.value = this._vf.silhouetteSharpness;
                        this.uniformFloatSilhouetteSharpness.fieldChanged("value");
                        break;
                }
            },

            uniforms: function(){
                var unis = [];
                if (this._cf.surfaceNormals.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][SilhouetteEnhancementVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }
                    this.uniformSampler2DSurfaceNormals._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DSurfaceNormals._vf.type = 'SFInt32';
                    this.uniformSampler2DSurfaceNormals._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DSurfaceNormals);
                }

                this.uniformFloatBoundaryOpacity._vf.name = 'uSilhouetteBoundaryOpacity';
                this.uniformFloatBoundaryOpacity._vf.type = 'SFFloat';
                this.uniformFloatBoundaryOpacity._vf.value = this._vf.silhouetteBoundaryOpacity;
                unis.push(this.uniformFloatBoundaryOpacity);

                this.uniformFloatRetainedOpacity._vf.name = 'uSilhouetteRetainedOpacity';
                this.uniformFloatRetainedOpacity._vf.type = 'SFFloat';
                this.uniformFloatRetainedOpacity._vf.value = this._vf.silhouetteRetainedOpacity;
                unis.push(this.uniformFloatRetainedOpacity);

                this.uniformFloatSilhouetteSharpness._vf.name = 'uSilhouetteSharpness';
                this.uniformFloatSilhouetteSharpness._vf.type = 'SFFloat';
                this.uniformFloatSilhouetteSharpness._vf.value = this._vf.silhouetteSharpness;
                unis.push(this.uniformFloatSilhouetteSharpness);

                this.uniformBoolEnableSilhouette._vf.name = 'uEnableSilhouette';
                this.uniformBoolEnableSilhouette._vf.type = 'SFBool';
                this.uniformBoolEnableSilhouette._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEnableSilhouette);

                return unis;
            },

            textures: function() {
                var texs = [];
                if (!(this._cf.surfaceNormals.node==null)) {
                    var tex = this._cf.surfaceNormals.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex)
                }
                return texs;
            },

            styleUniformsShaderText: function(){
                return "uniform float uSilhouetteBoundaryOpacity;\n"+
                    "uniform float uSilhouetteRetainedOpacity;\n"+
                    "uniform float uSilhouetteSharpness;\n"+
                    "uniform bool uEnableSilhouette;\n";
            },

            styleShaderText: function(){
                return "void silhouetteEnhancement(inout vec4 orig_color, vec4 normal, vec3 V)\n"+
                "{\n"+
                "   orig_color.a = orig_color.a * (uSilhouetteRetainedOpacity + uSilhouetteBoundaryOpacity * pow((1.0-abs(dot(normal.xyz, V))), uSilhouetteSharpness));\n"+
                "}\n"+
                "\n";
            },

            inlineStyleShaderText: function(){
                var inlineText = "  if(uEnableSilhouette){\n"+
                "       silhouetteEnhancement(value, grad, normalize(dir));\n"+
                "   }\n";
                return inlineText;
            },

            lightAssigment: function(){
                return "    value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n";
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### StippleVolumeStyle ### */
x3dom.registerNodeType(
    "StippleVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.StippleVolumeStyle.superClass.call(this, ctx);

            this.addField_SFFloat(ctx, 'distanceFactor', 1);
            this.addField_SFFloat(ctx, 'interiorFactor', 1);
            this.addField_SFFloat(ctx, 'lightingFactor', 1);
            this.addField_SFFloat(ctx, 'gradientThreshold', 0.4);
            this.addField_SFFloat(ctx, 'gradientRetainedOpacity', 1);
            this.addField_SFFloat(ctx, 'gradientBoundaryOpacity', 0);
            this.addField_SFFloat(ctx, 'gradientOpacityFactor', 1);
            this.addField_SFFloat(ctx, 'silhouetteRetainedOpacity', 1);
            this.addField_SFFloat(ctx, 'silhouetteBoundaryOpacity', 0);
            this.addField_SFFloat(ctx, 'silhouetteOpacityFactor', 1);
            this.addField_SFFloat(ctx, 'resolutionFactor', 1);
        }
    )
);

/* ### ToneMappedVolumeStyle ### */
x3dom.registerNodeType(
    "ToneMappedVolumeStyle",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DComposableVolumeRenderStyleNode,
        function (ctx) {
            x3dom.nodeTypes.ToneMappedVolumeStyle.superClass.call(this, ctx);

            this.addField_SFColor(ctx, 'coolColor', 0, 0, 1);
            this.addField_SFColor(ctx, 'warmColor', 1, 1, 0);

            this.uniformCoolColor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformWarmColor = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformSampler2DSurfaceNormals = new x3dom.nodeTypes.Uniform(ctx);
            this.uniformBoolEnableToneMapped = new x3dom.nodeTypes.Uniform(ctx);
        },
        {
            fieldChanged: function(fieldName){
                switch(fieldName){
                    case 'coolColor':
                        this.uniformCoolColor._vf.value = this._vf.coolColor;
                        this.uniformCoolColor.fieldChanged("value");
                        break;
                    case 'warmColor':
                        this.uniformWarmColor._vf.value = this._vf.warmColor;
                        this.uniformWarmColor.fieldChanged("value");
                        break;
                }
            },

            uniforms: function(){
                var unis = [];
                if (this._cf.surfaceNormals.node) {
                    //Lookup for the parent VolumeData
                    var volumeDataParent = this._parentNodes[0];
                    while(!x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) || !x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DNode)){
                        volumeDataParent = volumeDataParent._parentNodes[0];
                    }
                    if(x3dom.isa(volumeDataParent, x3dom.nodeTypes.X3DVolumeDataNode) == false){
                        x3dom.debug.logError("[VolumeRendering][ToneMappedVolumeStyle] Not VolumeData parent found!");
                        volumeDataParent = null;
                    }
                    this.uniformSampler2DSurfaceNormals._vf.name = 'uSurfaceNormals';
                    this.uniformSampler2DSurfaceNormals._vf.type = 'SFInt32';
                    this.uniformSampler2DSurfaceNormals._vf.value = volumeDataParent._textureID++;
                    unis.push(this.uniformSampler2DSurfaceNormals);
                }

                this.uniformCoolColor._vf.name = 'uCoolColor';
                this.uniformCoolColor._vf.type = 'SFColor';
                this.uniformCoolColor._vf.value = this._vf.coolColor;
                unis.push(this.uniformCoolColor);

                this.uniformWarmColor._vf.name = 'uWarmColor';
                this.uniformWarmColor._vf.type = 'SFColor';
                this.uniformWarmColor._vf.value = this._vf.warmColor;
                unis.push(this.uniformWarmColor);

                this.uniformBoolEnableToneMapped._vf.name = 'uEnableToneMapped';
                this.uniformBoolEnableToneMapped._vf.type = 'SFBool';
                this.uniformBoolEnableToneMapped._vf.value = this._vf.enabled;
                unis.push(this.uniformBoolEnableToneMapped);

                return unis;
            },

            textures: function() {
                var texs = [];
                if (this._cf.surfaceNormals.node) {
                    var tex = this._cf.surfaceNormals.node;
                    tex._vf.repeatS = false;
                    tex._vf.repeatT = false;
                    texs.push(tex)
                }
                return texs;
            },

            styleUniformsShaderText: function(){
                return "uniform vec3 uCoolColor;\n"+
                "uniform vec3 uWarmColor;\n"+
                "uniform bool uEnableToneMapped;\n";
            },

            styleShaderText: function(){
                var styleText = "void toneMapped(inout vec4 original_color, inout vec3 accum_color, vec3 surfNormal, vec3 lightDir)\n"+
                "{\n"+
                "   float color_factor = (1.0 + dot(lightDir, surfNormal))*0.5;\n"+
                "   accum_color += mix(uCoolColor, uWarmColor, color_factor);\n"+
                "   original_color.rgb = accum_color;\n"+
                "}\n";
                return styleText;
            },

            inlineStyleShaderText: function(){
                var shaderText = "    if(uEnableToneMapped){\n"+
                "       vec3 toneColor = vec3(0.0, 0.0, 0.0);\n"+
                "       vec3 L = vec3(0.0, 0.0, 0.0);\n";
                for(var l=0; l<x3dom.nodeTypes.X3DLightNode.lightID; l++) {
                    shaderText += "       L = (light"+l+"_Type == 1.0) ? normalize(light"+l+"_Location - positionE.xyz) : -light"+l+"_Direction;\n"+
                    "       toneMapped(value, toneColor, gradEye.xyz, L);\n";
                }
                shaderText += "    }\n";
                return shaderText;
            },

            lightAssigment: function(){
                return "    value.rgb = ambient*value.rgb + diffuse*value.rgb + specular;\n";
            },

            fragmentShaderText: function(numberOfSlices, slicesOverX, slicesOverY){
                var shader =
                this.preamble+
                this.defaultUniformsShaderText(numberOfSlices, slicesOverX, slicesOverY)+
                this.styleUniformsShaderText()+
                this.styleShaderText()+
                this.texture3DFunctionShaderText+
                this.normalFunctionShaderText()+
                this.lightEquationShaderText()+
                this.defaultLoopFragmentShaderText(this.inlineStyleShaderText(), this.lightAssigment());
                return shader;
            }
        }
    )
);

/* ### VolumeData ### */
x3dom.registerNodeType(
    "VolumeData",
    "VolumeRendering",
    defineClass(x3dom.nodeTypes.X3DVolumeDataNode,
        function (ctx) {
            x3dom.nodeTypes.VolumeData.superClass.call(this, ctx);

            this.addField_SFNode('renderStyle', x3dom.nodeTypes.X3DVolumeRenderStyleNode);

            this.vrcMultiTexture = new x3dom.nodeTypes.MultiTexture(ctx);
            this.vrcRenderTexture = new x3dom.nodeTypes.RenderedTexture(ctx);
            this.vrcVolumeTexture = null;

            this.vrcBackCubeShape = new x3dom.nodeTypes.Shape(ctx);
            this.vrcBackCubeAppearance = new x3dom.nodeTypes.Appearance();
            this.vrcBackCubeGeometry = new x3dom.nodeTypes.Box(ctx);
            this.vrcBackCubeShader = new x3dom.nodeTypes.ComposedShader(ctx);
            this.vrcBackCubeShaderVertex = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcBackCubeShaderFragment = new x3dom.nodeTypes.ShaderPart(ctx);

            this.vrcFrontCubeShader = new x3dom.nodeTypes.ComposedShader(ctx);
            this.vrcFrontCubeShaderVertex = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcFrontCubeShaderFragment = new x3dom.nodeTypes.ShaderPart(ctx);
            this.vrcFrontCubeShaderFieldBackCoord = new x3dom.nodeTypes.Field(ctx);
            this.vrcFrontCubeShaderFieldVolData = new x3dom.nodeTypes.Field(ctx);
            this.vrcFrontCubeShaderFieldOffset = new x3dom.nodeTypes.Field(ctx);
        },
        {
            // nodeChanged is called after subtree is parsed and attached in DOM
            nodeChanged: function()
            {
                // uhhhh, manually build backend-graph scene-subtree,
                // therefore, try to mimic depth-first parsing scheme
                if (!this._cf.appearance.node) 
                {
                    var that = this;
                    var i;

                    this.addChild(x3dom.nodeTypes.Appearance.defaultNode());
                    
                    // second texture, ray direction and length
                    this.vrcBackCubeShaderVertex._vf.type = 'vertex';
                    this.vrcBackCubeShaderVertex._vf.url[0] =
                        "attribute vec3 position;\n" +
                        "attribute vec3 color;\n" +
                        "varying vec3 fragColor;\n" +
                        "uniform mat4 modelViewProjectionMatrix;\n" +
                        "\n" +
                        "void main(void) {\n" +
                        "    fragColor = color;\n" +
                        "    gl_Position = modelViewProjectionMatrix * vec4(position, 1.0);\n" +
                        "}\n";

                    this.vrcBackCubeShaderFragment._vf.type = 'fragment';
                    this.vrcBackCubeShaderFragment._vf.url[0] =
                        "#ifdef GL_FRAGMENT_PRECISION_HIGH\n" +
                        "  precision highp float;\n" +
                        "#else\n" +
                        "  precision mediump float;\n" +
                        "#endif\n" +
                        "\n" +
                        "varying vec3 fragColor;\n" +
                        "\n" +
                        "void main(void) {\n" +
                        "    gl_FragColor = vec4(fragColor, 1.0);\n" +
                        "}\n";
                    
                    this.vrcBackCubeShader.addChild(this.vrcBackCubeShaderFragment, 'parts');
                    this.vrcBackCubeShaderFragment.nodeChanged();
                    
                    this.vrcBackCubeShader.addChild(this.vrcBackCubeShaderVertex, 'parts');
                    this.vrcBackCubeShaderVertex.nodeChanged();
                    
                    this.vrcBackCubeAppearance.addChild(this.vrcBackCubeShader);
                    this.vrcBackCubeShader.nodeChanged();
                    
                    // initialize fbo - note that internally the datatypes must fit!
                    this.vrcRenderTexture._vf.update = 'always';
                    this.vrcRenderTexture._vf.dimensions = [500, 500, 4];
                    this.vrcRenderTexture._vf.repeatS = false;
                    this.vrcRenderTexture._vf.repeatT = false;
                    this.vrcRenderTexture._nameSpace = this._nameSpace;
                    this._textureID++;

                    this.vrcBackCubeGeometry._vf.size = new x3dom.fields.SFVec3f(
                        this._vf.dimensions.x, this._vf.dimensions.y, this._vf.dimensions.z);
                    this.vrcBackCubeGeometry._vf.ccw = false;
                    this.vrcBackCubeGeometry._vf.solid = true;
                    // manually trigger size update
                    this.vrcBackCubeGeometry.fieldChanged("size");
                    
                    this.vrcBackCubeShape.addChild(this.vrcBackCubeGeometry);
                    this.vrcBackCubeGeometry.nodeChanged();
                    
                    this.vrcBackCubeShape.addChild(this.vrcBackCubeAppearance);
                    this.vrcBackCubeAppearance.nodeChanged();
                    
                    this.vrcRenderTexture.addChild(this.vrcBackCubeShape, 'scene');
                    this.vrcBackCubeShape.nodeChanged();
                    
                    // create shortcut to volume data set
                    this.vrcVolumeTexture = this._cf.voxels.node;
                    this.vrcVolumeTexture._vf.repeatS = false;
                    this.vrcVolumeTexture._vf.repeatT = false;
                    this._textureID++;
                    this.vrcMultiTexture._nameSpace = this._nameSpace;
                    
                    this.vrcMultiTexture.addChild(this.vrcRenderTexture, 'texture');
                    this.vrcRenderTexture.nodeChanged();
                    
                    this.vrcMultiTexture.addChild(this.vrcVolumeTexture, 'texture');
                    this.vrcVolumeTexture.nodeChanged();
                    
                    // textures from styles
                    if (this._cf.renderStyle.node.textures) {
                        var styleTextures = this._cf.renderStyle.node.textures();
                        for (i = 0; i<styleTextures.length; i++)
                        {
                            this.vrcMultiTexture.addChild(styleTextures[i], 'texture');
                            this.vrcVolumeTexture.nodeChanged();
                        }
                    }
                    
                    this._cf.appearance.node.addChild(this.vrcMultiTexture);
                    this.vrcMultiTexture.nodeChanged();
                    
                    // here goes the volume shader
                    this.vrcFrontCubeShaderVertex._vf.type = 'vertex';
                    this.vrcFrontCubeShaderVertex._vf.url[0]=this._cf.renderStyle.node.vertexShaderText();

                    this.vrcFrontCubeShaderFragment._vf.type = 'fragment';
                    this.vrcFrontCubeShaderFragment._vf.url[0]=this._cf.renderStyle.node.fragmentShaderText(
                            this.vrcVolumeTexture._vf.numberOfSlices,
                            this.vrcVolumeTexture._vf.slicesOverX, 
                            this.vrcVolumeTexture._vf.slicesOverY);

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderVertex, 'parts');
                    this.vrcFrontCubeShaderVertex.nodeChanged();
                    
                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFragment, 'parts');
                    this.vrcFrontCubeShaderFragment.nodeChanged();
                    
                    this.vrcFrontCubeShaderFieldBackCoord._vf.name = 'uBackCoord';
                    this.vrcFrontCubeShaderFieldBackCoord._vf.type = 'SFInt32';
                    this.vrcFrontCubeShaderFieldBackCoord._vf.value = 0;

                    this.vrcFrontCubeShaderFieldVolData._vf.name = 'uVolData';
                    this.vrcFrontCubeShaderFieldVolData._vf.type = 'SFInt32';
                    this.vrcFrontCubeShaderFieldVolData._vf.value = 1;

                    this.vrcFrontCubeShaderFieldOffset._vf.name = 'offset';
                    this.vrcFrontCubeShaderFieldOffset._vf.type = 'SFVec3f';
                    this.vrcFrontCubeShaderFieldOffset._vf.value = "0.01 0.01 0.01"; //Default initial value

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldBackCoord, 'fields');
                    this.vrcFrontCubeShaderFieldBackCoord.nodeChanged();
                    
                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldVolData, 'fields');
                    this.vrcFrontCubeShaderFieldVolData.nodeChanged();

                    this.vrcFrontCubeShader.addChild(this.vrcFrontCubeShaderFieldOffset, 'fields');
 
                    //Take volume texture size for the ComposableRenderStyles offset parameter
                    this.offsetInterval = window.setInterval((function(aTex) {
                        return function() {
                            x3dom.debug.logInfo('[VolumeRendering][VolumeData] Looking for Volume Texture size...');
                            var s = that.getTextureSize(aTex);
                            if(s.valid){
                                clearInterval(that.offsetInterval);
                                that.vrcFrontCubeShaderFieldOffset._vf.value = new x3dom.fields.SFVec3f(1.0/s.w, 1.0/s.h, 1.0/aTex._vf.numberOfSlices);
                                that.vrcFrontCubeShader.nodeChanged();
                                x3dom.debug.logInfo('[VolumeRendering][VolumeData] Volume Texture size obtained');
                            }
                        }
                    })(this.vrcVolumeTexture), 1000);
                    
                    var ShaderUniforms = this._cf.renderStyle.node.uniforms();
                    for (i = 0; i<ShaderUniforms.length; i++)
                    {
                        this.vrcFrontCubeShader.addChild(ShaderUniforms[i], 'fields');
                    }
                
                    this._cf.appearance.node.addChild(this.vrcFrontCubeShader);
                    this.vrcFrontCubeShader.nodeChanged();
                    
                    this._cf.appearance.node.nodeChanged();
                }

                if (!this._cf.geometry.node) {
                    this.addChild(new x3dom.nodeTypes.Box());

                    this._cf.geometry.node._vf.hasHelperColors = true;
                    this._cf.geometry.node._vf.size = new x3dom.fields.SFVec3f(
                        this._vf.dimensions.x, this._vf.dimensions.y, this._vf.dimensions.z);

                    // workaround to trigger field change...
                    this._cf.geometry.node.fieldChanged("hasHelperColors");
                    this._cf.geometry.node.fieldChanged("size");
                }
            }
        }
    )
);
