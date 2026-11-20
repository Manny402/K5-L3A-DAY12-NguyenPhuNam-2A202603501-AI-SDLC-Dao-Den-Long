# Changelog

Các tag `phase-1` đến `phase-4` lưu bản bàn giao từng checkpoint. `v1.0.0` trỏ tới `phase-4`; `v1.0.1` là bản vá sau đó. Thay đổi luật phá vỡ tương thích được ghi rõ bên dưới.

## Chưa phát hành — tài liệu

- Bổ sung README hướng dẫn cài đặt, chơi, kiểm chứng và video demo; thêm CREDITS và CHANGELOG đúng định dạng bàn giao.

## v1.0.1 — hoàn thiện trình bày

- Thêm nhạc nền và các tín hiệu âm thanh cho nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện và đếm ngược.
- HUD có ô đom đóm theo sức chứa, chỉ báo hồi chiêu và mũi tên tới đèn chưa sáng ngoài màn hình.
- Đêm 3 có hai dốc, va chạm vách tầng và tháp chuông; các tầng trên mờ đi khi che camera.
- Đèn tắt có giấy rách và thấp hơn 20%. Bổ sung test địa hình và ảnh kiểm chứng.

## Phase 4 / v1.0.0 — Test Contract v1.3

- Thêm benchmark 1280×720 với cảnh chuẩn, báo cáo FPS và thời gian tải; thêm soak test 10 đêm với báo cáo bộ nhớ.
- Thêm bảng xếp hạng top 10 lưu cục bộ và lệnh xuất JSON.
- Thêm đổi phím, chữ lớn, giảm chuyển động và chỉ báo cảnh báo.
- Phát hành bản chạy được cùng `game.contract.json`, test, bằng chứng, `LICENSE` và hướng dẫn nhanh.

## Phase 3 — Test Contract v1.2, thay đổi phá vỡ tương thích

- **Luật thắng:** bỏ thắng sớm khi thắp đủ đèn; thắng tại bình minh nếu còn sống và ≥ 60% đèn đang sáng. Lý do thắng đổi từ `all_lit` thành `dawn_survived`.
- **Thời gian:** Đêm 1/2/3 đổi từ 300/330/360 thành 240/270/300 giây.
- **Đèn:** thêm dầu tối đa 100, hao 1/giây, châm dầu, tắt khi cạn và thắp lại với 5 đom đóm. Đèn dưới 30 dầu mất vùng an toàn; Bóng Mực có thể hút dầu.
- **Sức chứa và điểm:** sức chứa tăng theo số lần thắp; thay toàn bộ công thức điểm của Phase 2. Snapshot và sự kiện headless có thêm dầu, `ever_lit`, sức chứa, `refuel`, `lantern_out` và `fuel_drain`.
- Cập nhật test theo luật mới; quyết định thiết kế được ghi trong `docs/notes/phase3-adr.txt`.

## Phase 2 — Test Contract v1.1

- Chuẩn hóa tốc độ, nhảy, lướt, sức chứa, đèn, tỏa sáng, Bóng Mực và cách tính điểm theo Ticket-02.
- Mở rộng thành Đêm 2 — Đảo Cau và Đêm 3 — Đảo Chuông; thêm Gió Lạc, Bùa Gió, gió, tạm dừng và cài đặt.
- Headless nhận `--night 1|2|3`, thêm các trường snapshot và sự kiện của v1.1. Các test Phase 1 tiếp tục được chạy lại.

## Phase 1 — Test Contract v1.0

- Tạo Đêm 1 — Đảo Bến với Mây, năm đèn, đom đóm, Bóng Mực, tỏa sáng, thắng/thua và chơi lại.
- Tạo mô phỏng 60 tick/giây dùng chung cho bản WebGL và headless; xuất JSONL tất định theo seed.
