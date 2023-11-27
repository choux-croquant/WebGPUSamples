(async () => {
    const GRID_SIZE = 12;
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

    const vertices = new Float32Array([
      //   X,    Y,
        -0.8, -0.8, // Triangle 1 (Blue)
         0.8, -0.8,
         0.8,  0.8,

        -0.8, -0.8, // Triangle 2 (Red)
         0.8,  0.8,
        -0.8,  0.8,
    ]);

    const vertexBuffer = device.createBuffer({
      label: "Cell vertices",
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // Create buffer for grid
    const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
    const uniformBuffer = device.createBuffer({
      label: "Grid Uniforms",
      size: uniformArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

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
    // const cellShaderModule = device.createShaderModule({
    //   label: "Cell shader",
    //   code: `
    //     @group(0) @binding(0) var<uniform> grid: vec2f;

    //     @vertex
    //     fn vertexMain(@location(0) pos: vec2f,
    //                   @builtin(instance_index) instance: u32) ->
    //       @builtin(position) vec4f {

    //       let i = f32(instance);
    //       // Compute the cell coordinate from the instance_index
    //       let cell = vec2f(i % grid.x, floor(i / grid.x));

    //       let cellOffset = cell / grid * 2;
    //       let gridPos = (pos + 1) / grid - 1 + cellOffset;

    //       return vec4f(gridPos, 0, 1);
    //     }

    //     @fragment
    //     fn fragmentMain() -> @location(0) vec4f {
    //       return vec4f(1, 0, 0, 1);
    //     }
    //   `
    // });

    const cellShaderModule = device.createShaderModule({
      label: "Cell shader",
      code: `
        struct VertexInput {
          @location(0) pos: vec2f,
          @builtin(instance_index) instance: u32,
        };

        struct VertexOutput {
          @builtin(position) pos: vec4f,
          @location(0) cell: vec2f, // New line!
        };

        @group(0) @binding(0) var<uniform> grid: vec2f;

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput  {
          let i = f32(input.instance);
          let cell = vec2f(i % grid.x, floor(i / grid.x));
          let cellOffset = cell / grid * 2;
          let gridPos = (input.pos + 1) / grid - 1 + cellOffset;

          var output: VertexOutput;
          output.pos = vec4f(gridPos, 0, 1);
          output.cell = cell;
          return output;
        }

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
          let c = input.cell / grid;
          return vec4f(c, 1-c.x, 1);
        }
      `
    });

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

    const bindGroup = device.createBindGroup({
      label: "Cell renderer bind group",
      layout: cellPipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: uniformBuffer }
      }],
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
    pass.setBindGroup(0, bindGroup);
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

    pass.end();

    const commandBuffer = encoder.finish();

    device.queue.submit([commandBuffer]);
    device.queue.submit([encoder.finish()]);
})();