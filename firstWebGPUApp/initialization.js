(async () => {
    const canvas = document.querySelector("canvas");

    // Error Case - Not support or No adequate adapter
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported on this browser.");
    }

    // Adapter - webGPU에서 정의하는 추상화된 GPU 하드웨어, 기기에 따라 선택할 수 있는 경우도 존재
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No appropriate GPUAdapter found.");
    }

    // GPU와의 상호작용을 위한 인터페이스
    const device = await adapter.requestDevice();

    // Canvas context initialization
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: device,
      format: canvasFormat,
    });

    // GPU command 기록을 위한 interface, 렌더 패스를 다루기 위해 선언
    const encoder = device.createCommandEncoder();

    // 렌더패스를 실행 후 종료
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
      }]
    });

    pass.end();

    // finish() 호출을 통해 commandBuffer 생성
    const commandBuffer = encoder.finish();

    // commandBuffer를 submit
    device.queue.submit([commandBuffer]);
    device.queue.submit([encoder.finish()]);
})();