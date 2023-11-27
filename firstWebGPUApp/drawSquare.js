(async () => {
    const canvas = document.querySelector("canvas");

    if (!navigator.gpu) {
      throw new Error("WebGPU not supported on this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No appropriate GPUAdapter found.");
    }

    const device = await adapter.requestDevice();

    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: device,
      format: canvasFormat,
    });

    // Square vertices array
    const vertices = new Float32Array([
      //   X,    Y,
        -0.8, -0.8, // Triangle 1 (Blue)
         0.8, -0.8,
         0.8,  0.8,

        -0.8, -0.8, // Triangle 2 (Red)
         0.8,  0.8,
        -0.8,  0.8,
    ]);

    // Vertex buffer for square
    const vertexBuffer = device.createBuffer({
      label: "Cell vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Copy vertex data to buffer`s memory
    device.queue.writeBuffer(vertexBuffer, /*bufferOffset=*/0, vertices);

    // Make vertex data layout for GPU
    const vertexBufferLayout = {
      arrayStride: 8,
      attributes: [{
        format: "float32x2",
        offset: 0,
        shaderLocation: 0, // Position, see vertex shader
      }],
    };

    // WGSL shader module for render with GPU
    const cellShaderModule = device.createShaderModule({
      label: "Cell shader",
      code: `
        @vertex
        fn vertexMain(@location(0) pos: vec2f) ->
          @builtin(position) vec4f {
          return vec4f(pos.x, pos.y, 0, 1);
        }

        @fragment
        fn fragmentMain() -> @location(0) vec4f {
          return vec4f(1, 0, 0, 1);
        }
      `
    });

    // Create Rendering Pipeline to start render
    // Rendering Pipeline은 shader, vertex buffer layout 등 canvas에 그리는 방식을 제어함
    const cellPipeline = device.createRenderPipeline({
      label: "Cell pipeline",
      layout: "auto",
      vertex: {
        module: cellShaderModule,
        entryPoint: "vertexMain",
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module: cellShaderModule,
        entryPoint: "fragmentMain",
        targets: [{
          format: canvasFormat
        }]
      }
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
      }]
    });

    // Set all the data for draw square in GPU
    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2); // 6 vertices

    pass.end();

    const commandBuffer = encoder.finish();

    device.queue.submit([commandBuffer]);
    device.queue.submit([encoder.finish()]);
})();