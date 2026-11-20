# Credits and Asset Licenses

## Ý tưởng và nội dung

Nhân vật Mây, Bóng Mực, Gió Lạc, ba hòn đảo và các luật cốt lõi bắt nguồn từ PRD-0 và Ticket-02/03/04 của lab **Đảo Đèn Lồng**. Phần hiện thực trò chơi trong repo này do Nguyễn Phú Nam thực hiện với hỗ trợ của Codex.

## Hình ảnh và âm thanh

| Thành phần | Nguồn | Giấy phép/ghi chú |
| --- | --- | --- |
| Nhân vật, đèn, đảo, dốc, HUD và hiệu ứng hiển thị | Hình học và CSS tạo trong `public/`; không dùng ảnh hoặc model ngoài | Mã nguồn dự án: [MIT](LICENSE) |
| Nhạc nền đêm và hiệu ứng âm thanh | Tổng hợp tại thời điểm chạy bằng Web Audio trong `public/game.mjs`; không dùng file âm thanh ngoài | Mã nguồn dự án: [MIT](LICENSE) |
| Ảnh minh họa và bằng chứng trong `docs/proof/` | Chụp từ chính game và các lệnh kiểm chứng của repo | Không dùng ảnh bên thứ ba |

## Thư viện và công cụ

| Thành phần | Vai trò | Giấy phép |
| --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) 0.181.2 | Dựng cảnh 3D WebGL | MIT |
| [Playwright Core](https://github.com/microsoft/playwright) 1.56.1 | Kiểm tra trình duyệt và đo benchmark | Apache-2.0 |
| Codex (OpenAI) | Hỗ trợ soạn mã, test và tài liệu; kết quả được kiểm tra bằng lệnh thực tế | Công cụ AI, không phải asset ngoài |

Danh sách trên không bao gồm asset tải từ kho hình ảnh, model 3D hoặc âm thanh. Phiên bản dependency chính xác được khóa trong `package-lock.json`.
