-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 20, 2026 at 02:48 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `stockoffice_multibmu`
--

-- --------------------------------------------------------

--
-- Table structure for table `billing_notes`
--

CREATE TABLE `billing_notes` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `doc_no` varchar(40) NOT NULL,
  `doc_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `customer_id` int(11) NOT NULL,
  `status` enum('DRAFT','ISSUED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `total_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `billing_note_items`
--

CREATE TABLE `billing_note_items` (
  `id` bigint(20) NOT NULL,
  `billing_note_id` bigint(20) NOT NULL,
  `sales_id` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `commission_payments`
--

CREATE TABLE `commission_payments` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `document_no` varchar(50) DEFAULT NULL,
  `seller_id` int(11) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `total_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `finance_account_id` int(11) NOT NULL,
  `finance_transaction_id` int(11) DEFAULT NULL,
  `paid_by` int(11) NOT NULL,
  `paid_date` datetime NOT NULL DEFAULT current_timestamp(),
  `note` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `commission_payments`
--

INSERT INTO `commission_payments` (`id`, `company_id`, `document_no`, `seller_id`, `period_start`, `period_end`, `total_amount`, `finance_account_id`, `finance_transaction_id`, `paid_by`, `paid_date`, `note`, `created_at`, `updated_at`) VALUES
(1, 1, 'CP202603-0001', 7, '2026-03-01', '2026-03-31', 10900.00, 3, 10, 4, '2026-03-20 19:44:40', '', '2026-03-20 19:44:40', '2026-03-20 19:44:40'),
(2, 1, 'CP202603-0002', 6, '2026-03-01', '2026-03-31', 10000.00, 4, 11, 4, '2026-03-20 20:24:10', '', '2026-03-20 20:24:10', '2026-03-20 20:24:10');

-- --------------------------------------------------------

--
-- Table structure for table `commission_payment_items`
--

CREATE TABLE `commission_payment_items` (
  `id` int(11) NOT NULL,
  `commission_payment_id` int(11) NOT NULL,
  `sale_id` int(11) NOT NULL,
  `original_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `commission_payment_items`
--

INSERT INTO `commission_payment_items` (`id`, `commission_payment_id`, `sale_id`, `original_amount`, `paid_amount`, `created_at`) VALUES
(1, 1, 4, 900.00, 900.00, '2026-03-20 12:44:40'),
(2, 1, 5, 10000.00, 10000.00, '2026-03-20 12:44:40'),
(3, 2, 3, 5000.00, 10000.00, '2026-03-20 13:24:10');

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `tax_id` varchar(32) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `default_tax_point` enum('INVOICE','SHIPMENT','RECEIPT','MANUAL') NOT NULL DEFAULT 'MANUAL',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `companies`
--

INSERT INTO `companies` (`id`, `name`, `tax_id`, `address`, `phone`, `email`, `default_tax_point`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Stark company', '1111111111111', 'BKK', '0955217773', 'PRPSIX777@Gmail.com', 'MANUAL', 1, '2026-03-20 10:49:29', '2026-03-20 10:49:29');

-- --------------------------------------------------------

--
-- Table structure for table `company_doc_configs`
--

CREATE TABLE `company_doc_configs` (
  `company_id` int(11) NOT NULL,
  `doc_type` varchar(20) NOT NULL,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `format_code` varchar(50) NOT NULL DEFAULT 'P1_STD_YYYYMM',
  `prefix` varchar(20) NOT NULL,
  `reset_policy` enum('NONE','YEARLY','MONTHLY','DAILY') NOT NULL DEFAULT 'MONTHLY',
  `pattern` varchar(120) DEFAULT NULL,
  `allow_manual` tinyint(1) NOT NULL DEFAULT 0,
  `manual_regex` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `company_doc_configs`
--

INSERT INTO `company_doc_configs` (`company_id`, `doc_type`, `is_enabled`, `format_code`, `prefix`, `reset_policy`, `pattern`, `allow_manual`, `manual_regex`, `created_at`, `updated_at`) VALUES
(1, 'BN', 1, 'P1_STD_YYYYMM', 'BN', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'CN', 1, 'P1_STD_YYYYMM', 'CN', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'CP', 1, 'P1_STD_YYYYMM', 'CP', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:44:36', '2026-03-20 12:44:36'),
(1, 'DN', 1, 'P1_STD_YYYYMM', 'DN', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'DO', 1, 'P1_STD_YYYYMM', 'DO', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:20:50', '2026-03-20 12:20:50'),
(1, 'GRN', 1, 'P1_STD_YYYYMM', 'GR', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'INV', 1, 'P1_STD_YYYYMM', 'IV', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'IV', 1, 'P1_STD_YYYYMM', 'IV', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:20:50', '2026-03-20 12:20:50'),
(1, 'PO', 1, 'P1_STD_YYYYMM', 'PO', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'PR', 1, 'P1_STD_YYYYMM', 'PR', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'QT', 1, 'P1_STD_YYYYMM', 'QT', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'RE', 1, 'P1_STD_YYYYMM', 'RE', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'SA', 1, 'P1_STD_YYYYMM', 'SA', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'SO', 1, 'P1_STD_YYYYMM', 'SO', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37'),
(1, 'Tax', 1, 'P1_STD_YYYYMM', 'TAX', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:20:50', '2026-03-20 12:20:50'),
(1, 'TR', 1, 'P1_STD_YYYYMM', 'TR', 'MONTHLY', NULL, 1, NULL, '2026-03-20 12:07:25', '2026-03-20 12:17:37');

-- --------------------------------------------------------

--
-- Table structure for table `company_doc_sequences`
--

CREATE TABLE `company_doc_sequences` (
  `company_id` int(11) NOT NULL,
  `doc_type` varchar(20) NOT NULL,
  `period_key` varchar(20) NOT NULL,
  `last_seq` int(11) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `company_doc_sequences`
--

INSERT INTO `company_doc_sequences` (`company_id`, `doc_type`, `period_key`, `last_seq`, `updated_at`) VALUES
(1, 'CP', '2026-03', 2, '2026-03-20 13:24:10'),
(1, 'DO', '2026-03', 5, '2026-03-20 12:30:43'),
(1, 'IV', '2026-03', 5, '2026-03-20 12:30:42'),
(1, 'PO', '2026-03', 4, '2026-03-20 12:29:48'),
(1, 'QT', '2026-03', 5, '2026-03-20 12:30:40'),
(1, 'RE', '2026-03', 5, '2026-03-20 12:30:47'),
(1, 'Tax', '2026-03', 5, '2026-03-20 12:30:42');

-- --------------------------------------------------------

--
-- Table structure for table `finance_accounts`
--

CREATE TABLE `finance_accounts` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `type` enum('CASH','BANK','EWALLET','ADVANCE') NOT NULL,
  `name` varchar(100) NOT NULL,
  `provider_name` varchar(100) DEFAULT NULL,
  `account_no` varchar(100) DEFAULT NULL,
  `account_name` varchar(150) DEFAULT NULL,
  `person_name` varchar(150) DEFAULT NULL,
  `contact_number` varchar(50) DEFAULT NULL,
  `balance` decimal(15,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `finance_accounts`
--

INSERT INTO `finance_accounts` (`id`, `company_id`, `type`, `name`, `provider_name`, `account_no`, `account_name`, `person_name`, `contact_number`, `balance`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 'CASH', 'เงินสด', NULL, NULL, NULL, NULL, NULL, -629850.00, 1, '2026-03-20 12:09:03', '2026-03-20 12:30:47'),
(2, 1, 'BANK', 'Tw', 'ธนาคารกสิกรไทย (KBANK)', '1231321311', 'Tw', NULL, NULL, 1000000.00, 0, '2026-03-20 12:09:18', '2026-03-20 12:09:23'),
(3, 1, 'BANK', 'Tw', 'ธนาคารกสิกรไทย (KBANK)', '1231321311', 'Tw', NULL, NULL, 1203100.00, 1, '2026-03-20 12:09:18', '2026-03-20 12:44:40'),
(4, 1, 'EWALLET', 'TE', 'PromptPay', '231311231', 'TE', NULL, NULL, 90000.00, 1, '2026-03-20 12:09:41', '2026-03-20 13:24:10');

-- --------------------------------------------------------

--
-- Table structure for table `finance_transactions`
--

CREATE TABLE `finance_transactions` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `finance_account_id` int(11) NOT NULL,
  `transaction_type` enum('INCOME','EXPENSE') NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'เช่น SALES_RECEIPT, PURCHASE_BILL',
  `reference_id` int(11) DEFAULT NULL COMMENT 'ID ของเอกสารอ้างอิง (เช่น sales.id หรือ purchase_bills.id)',
  `transaction_date` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `finance_transactions`
--

INSERT INTO `finance_transactions` (`id`, `company_id`, `finance_account_id`, `transaction_type`, `amount`, `reference_type`, `reference_id`, `transaction_date`, `created_at`, `created_by`, `note`) VALUES
(1, 1, 1, 'EXPENSE', 509000.00, 'PURCHASE_BILL', 1, '2026-03-20 00:00:00', '2026-03-20 12:09:55', 5, NULL),
(2, 1, 3, 'INCOME', 107000.00, 'SALES_RECEIPT', 1, '2026-03-20 19:21:04', '2026-03-20 12:21:04', 5, NULL),
(3, 1, 3, 'INCOME', 107000.00, 'SALES_RECEIPT', 2, '2026-03-20 19:25:01', '2026-03-20 12:25:01', 5, NULL),
(4, 1, 1, 'INCOME', 107000.00, 'SALES_RECEIPT', 3, '2026-03-20 19:26:08', '2026-03-20 12:26:08', 6, NULL),
(5, 1, 1, 'INCOME', 48150.00, 'SALES_RECEIPT', 4, '2026-03-20 19:27:32', '2026-03-20 12:27:32', 7, NULL),
(6, 1, 1, 'EXPENSE', 500000.00, 'PURCHASE_BILL', 3, '2026-03-20 00:00:00', '2026-03-20 12:28:57', 7, NULL),
(7, 1, 1, 'EXPENSE', 90000.00, 'PURCHASE_BILL', 4, '2026-03-20 00:00:00', '2026-03-20 12:29:57', 7, NULL),
(8, 1, 1, 'INCOME', 214000.00, 'SALES_RECEIPT', 5, '2026-03-20 19:30:47', '2026-03-20 12:30:47', 7, NULL),
(10, 1, 3, 'EXPENSE', 10900.00, 'COMMISSION', NULL, '0000-00-00 00:00:00', '2026-03-20 12:44:40', 4, 'จ่ายค่าคอมมิชชั่น'),
(11, 1, 4, 'EXPENSE', 10000.00, 'COMMISSION', NULL, '0000-00-00 00:00:00', '2026-03-20 13:24:10', 4, 'จ่ายค่าคอมมิชชั่น');

-- --------------------------------------------------------

--
-- Table structure for table `goods_receipts`
--

CREATE TABLE `goods_receipts` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `grn_no` varchar(40) NOT NULL,
  `po_id` bigint(20) DEFAULT NULL,
  `bill_id` int(11) DEFAULT NULL,
  `vendor_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `issue_date` date NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_stage` varchar(50) DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `is_manual` tinyint(1) NOT NULL DEFAULT 0,
  `extra_charge_amt` decimal(18,2) DEFAULT 0.00,
  `extra_charge_note` varchar(255) DEFAULT NULL,
  `header_discount_type` enum('PERCENT','AMOUNT') DEFAULT NULL,
  `header_discount_value` decimal(15,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `goods_receipts`
--

INSERT INTO `goods_receipts` (`id`, `company_id`, `grn_no`, `po_id`, `bill_id`, `vendor_id`, `warehouse_id`, `status`, `issue_date`, `note`, `created_by`, `approved_by`, `approved_at`, `created_at`, `updated_at`, `cancelled_by`, `cancelled_at`, `cancel_stage`, `cancel_reason`, `is_manual`, `extra_charge_amt`, `extra_charge_note`, `header_discount_type`, `header_discount_value`) VALUES
(1, 1, 'GRN-BILL-PO202603-0001', 1, 1, 7, 3, 'APPROVED', '2026-03-20', NULL, 5, 5, '2026-03-20 19:17:42', '2026-03-20 12:17:40', '2026-03-20 12:17:42', NULL, NULL, NULL, NULL, 1, 10000.00, 'ค่าขนส่ง', 'AMOUNT', 1000.00),
(2, 1, 'GRN-BILL-PO202603-0002', 2, 2, 8, 4, 'APPROVED', '2026-03-20', NULL, 7, 7, '2026-03-20 19:28:24', '2026-03-20 12:28:22', '2026-03-20 12:28:24', NULL, NULL, NULL, NULL, 1, 0.00, NULL, 'AMOUNT', 0.00),
(3, 1, 'GRN-BILL-PO202603-0003', 3, 3, 9, 4, 'APPROVED', '2026-03-20', NULL, 7, 7, '2026-03-20 19:29:02', '2026-03-20 12:29:01', '2026-03-20 12:29:02', NULL, NULL, NULL, NULL, 1, 0.00, NULL, 'AMOUNT', 0.00),
(4, 1, 'GRN-BILL-PO202603-0004', 4, 4, 8, 4, 'APPROVED', '2026-03-20', NULL, 7, 7, '2026-03-20 19:30:02', '2026-03-20 12:30:01', '2026-03-20 12:30:02', NULL, NULL, NULL, NULL, 1, 0.00, NULL, 'AMOUNT', 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `goods_receipt_items`
--

CREATE TABLE `goods_receipt_items` (
  `id` bigint(20) NOT NULL,
  `goods_receipt_id` bigint(20) NOT NULL,
  `bill_item_id` int(11) DEFAULT NULL,
  `product_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL,
  `unit_cost` decimal(14,6) NOT NULL,
  `discount_pct` decimal(8,3) DEFAULT 0.000,
  `discount_amt` decimal(18,4) DEFAULT 0.0000,
  `tax_type` enum('EXCLUDE_VAT_7','INCLUDE_VAT_7','NO_VAT') DEFAULT 'EXCLUDE_VAT_7',
  `manual_vat` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `goods_receipt_items`
--

INSERT INTO `goods_receipt_items` (`id`, `goods_receipt_id`, `bill_item_id`, `product_id`, `qty`, `unit_cost`, `discount_pct`, `discount_amt`, `tax_type`, `manual_vat`) VALUES
(1, 1, 1, 32, 1000, 500.000000, 0.000, 0.0000, 'EXCLUDE_VAT_7', NULL),
(2, 2, 2, 31, 1000, 150.000000, 0.000, 0.0000, 'EXCLUDE_VAT_7', NULL),
(3, 3, 3, 30, 500, 1000.000000, 0.000, 0.0000, 'EXCLUDE_VAT_7', NULL),
(4, 4, 4, 31, 500, 180.000000, 0.000, 0.0000, 'EXCLUDE_VAT_7', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `invoice_sequences`
--

CREATE TABLE `invoice_sequences` (
  `company_id` int(11) NOT NULL,
  `ym` char(6) NOT NULL,
  `last_no` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `invoice_sequences`
--

INSERT INTO `invoice_sequences` (`company_id`, `ym`, `last_no`) VALUES
(1, '202602', 6);

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` int(11) NOT NULL,
  `code` varchar(80) NOT NULL,
  `name` varchar(150) NOT NULL,
  `module` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `code`, `name`, `module`, `created_at`) VALUES
(1, 'system.admin', 'System admin', 'system', '2026-02-03 07:07:29'),
(2, 'master.company.manage', 'Manage companies', 'master', '2026-02-03 07:07:29'),
(3, 'master.user.manage', 'Manage users', 'master', '2026-02-03 07:07:29'),
(4, 'master.role.manage', 'Manage roles', 'master', '2026-02-03 07:07:29'),
(5, 'master.permission.manage', 'Manage permissions', 'master', '2026-02-03 07:07:29'),
(6, 'master.vendor.manage', 'Manage vendors', 'master', '2026-02-03 07:07:29'),
(7, 'master.product.manage', 'Manage products', 'master', '2026-02-03 07:07:29'),
(8, 'master.warehouse.manage', 'Manage warehouses', 'master', '2026-02-03 07:07:29'),
(9, 'stock.view', 'View stock', 'stock', '2026-02-03 07:07:29'),
(10, 'purchase.grn.manage', 'Manage GRN', 'purchase', '2026-02-03 07:07:29'),
(11, 'sales.inv.manage', 'Manage sales invoice', 'sales', '2026-02-03 07:07:29'),
(12, 'stock.adjust.manage', 'Manage stock adjustment', 'stock', '2026-02-03 10:03:38'),
(13, 'purchase.po.manage', 'Manage purchase order', 'purchase', '2026-02-03 17:27:52'),
(14, 'purchase.bill.manage', 'Manage purchase bill', 'purchase', '2026-02-12 10:03:30'),
(15, 'stock.manage', 'Manage stock transfers and count', 'stock', '2026-03-05 14:48:21');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `code` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `sell_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_vat` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `company_id`, `code`, `name`, `unit`, `sell_price`, `is_active`, `created_at`, `updated_at`, `is_vat`) VALUES
(1, 1, 'P-0001', 'Com', 'pts', 10000.00, 1, '2026-03-20 12:01:17', '2026-03-20 12:01:17', 1),
(2, 1, 'P-0002', 'iphone', 'pts', 1000.00, 1, '2026-03-20 12:01:28', '2026-03-20 12:01:28', 1),
(23, 1, 'P-0011', 'กระดาษ A4 Double A (500 แผ่น)', 'รีม', 120.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(24, 1, 'P-0012', 'ปากกาลูกลื่น Lancer สีน้ำเงิน', 'ด้าม', 5.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(25, 1, 'P-0013', 'เครื่องพิมพ์ Laser Brother HL-1110', 'เครื่อง', 2500.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(26, 1, 'P-0014', 'หมึกพิมพ์แท้ Brother TN-1000', 'ตลับ', 990.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(27, 1, 'P-0015', 'เครื่องทำกาแฟแคปซูล Nespresso', 'เครื่อง', 5500.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(28, 1, 'P-0016', 'น้ำดื่มคริสตัล 600ml (แพ็ค 12 ขวด)', 'แพ็ค', 55.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 0),
(29, 1, 'P-0017', 'แฟ้มสันกว้าง ตราช้าง 2101', 'อัน', 45.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(30, 1, 'P-0018', 'แม็กเย็บกระดาษ MAX HD-10', 'อัน', 65.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(31, 1, 'P-0019', 'เก้าอี้สำนักงานเพื่อสุขภาพ (Ergonomic Chair)', 'ตัว', 3990.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 1),
(32, 1, 'P-0020', 'บริการจัดส่งและติดตั้งอุปกรณ์ด่วนพิเศษ', 'ครั้ง', 500.00, 1, '2026-03-20 12:04:03', '2026-03-20 12:04:03', 0);

-- --------------------------------------------------------

--
-- Table structure for table `product_stock`
--

CREATE TABLE `product_stock` (
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `qty` int(11) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `product_stock`
--

INSERT INTO `product_stock` (`product_id`, `warehouse_id`, `company_id`, `qty`, `updated_at`) VALUES
(30, 4, 1, 500, '2026-03-20 12:29:02'),
(31, 4, 1, 1400, '2026-03-20 12:30:42'),
(32, 3, 1, 600, '2026-03-20 12:27:28');

-- --------------------------------------------------------

--
-- Table structure for table `purchase_bills`
--

CREATE TABLE `purchase_bills` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `bill_no` varchar(50) NOT NULL,
  `tax_invoice_no` varchar(50) NOT NULL,
  `po_id` int(11) DEFAULT NULL,
  `vendor_id` int(11) NOT NULL,
  `vendor_person_id` int(11) DEFAULT NULL,
  `vendor_person_prefix` varchar(50) DEFAULT NULL,
  `vendor_person_first_name` varchar(100) DEFAULT NULL,
  `vendor_person_last_name` varchar(100) DEFAULT NULL,
  `vendor_person_nickname` varchar(100) DEFAULT NULL,
  `vendor_person_email` varchar(191) DEFAULT NULL,
  `vendor_person_phone` varchar(50) DEFAULT NULL,
  `vendor_person_position` varchar(100) DEFAULT NULL,
  `vendor_person_department` varchar(100) DEFAULT NULL,
  `warehouse_id` int(11) NOT NULL,
  `issue_date` date NOT NULL,
  `paid_date` date DEFAULT NULL,
  `note` text DEFAULT NULL,
  `extra_charge_amt` decimal(18,2) NOT NULL DEFAULT 0.00,
  `extra_charge_note` varchar(255) DEFAULT NULL,
  `header_discount_type` enum('PERCENT','AMOUNT') DEFAULT NULL,
  `header_discount_value` decimal(15,2) NOT NULL DEFAULT 0.00,
  `status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `created_by` int(11) NOT NULL,
  `is_manual` tinyint(1) NOT NULL DEFAULT 1,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `finance_account_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `purchase_bills`
--

INSERT INTO `purchase_bills` (`id`, `company_id`, `bill_no`, `tax_invoice_no`, `po_id`, `vendor_id`, `vendor_person_id`, `vendor_person_prefix`, `vendor_person_first_name`, `vendor_person_last_name`, `vendor_person_nickname`, `vendor_person_email`, `vendor_person_phone`, `vendor_person_position`, `vendor_person_department`, `warehouse_id`, `issue_date`, `paid_date`, `note`, `extra_charge_amt`, `extra_charge_note`, `header_discount_type`, `header_discount_value`, `status`, `created_by`, `is_manual`, `approved_by`, `approved_at`, `cancelled_by`, `cancelled_at`, `cancel_reason`, `created_at`, `updated_at`, `finance_account_id`) VALUES
(1, 1, 'BILL-PO202603-0001', 'TAX-PO202603-0001', 1, 7, 14, 'คุณ', 'สมปอง', 'ค้าขายดี', 'ปอง', 'sompong@supplier-a.com', '089-111-2222', 'ผู้จัดการฝ่ายขาย', 'ฝ่ายขาย', 3, '2026-03-20', '2026-03-20', NULL, 10000.00, 'ค่าขนส่ง', 'AMOUNT', 1000.00, 'APPROVED', 5, 1, 5, '2026-03-20 19:09:58', NULL, NULL, NULL, '2026-03-20 12:09:55', '2026-03-20 12:09:58', 1),
(2, 1, 'BILL-PO202603-0002', 'TAX-PO202603-0002', 2, 8, 6, 'คุณ', 'สมหญิง', 'ใจดี', 'หญิง', 'somying@customer-b.com', '081-333-4444', 'หัวหน้าจัดซื้อ', 'จัดซื้อ', 4, '2026-03-20', NULL, NULL, 0.00, NULL, 'AMOUNT', 0.00, 'APPROVED', 7, 1, 7, '2026-03-20 19:28:18', NULL, NULL, NULL, '2026-03-20 12:28:14', '2026-03-20 12:28:18', NULL),
(3, 1, 'BILL-PO202603-0003', 'TAX-PO202603-0003', 3, 9, 7, 'นาย', 'สมชาย', 'รักการค้า', 'ชาย', 'somchai@gmail.com', '081-999-8888', 'เจ้าของกิจการ', 'บริหาร', 4, '2026-03-20', '2026-03-20', NULL, 0.00, NULL, 'AMOUNT', 0.00, 'APPROVED', 7, 1, 7, '2026-03-20 19:28:58', NULL, NULL, NULL, '2026-03-20 12:28:57', '2026-03-20 12:28:58', 1),
(4, 1, 'BILL-PO202603-0004', 'TAX-PO202603-0004', 4, 8, 6, 'คุณ', 'สมหญิง', 'ใจดี', 'หญิง', 'somying@customer-b.com', '081-333-4444', 'หัวหน้าจัดซื้อ', 'จัดซื้อ', 4, '2026-03-20', '2026-03-20', NULL, 0.00, NULL, 'AMOUNT', 0.00, 'APPROVED', 7, 1, 7, '2026-03-20 19:29:59', NULL, NULL, NULL, '2026-03-20 12:29:57', '2026-03-20 12:29:59', 1);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_bill_items`
--

CREATE TABLE `purchase_bill_items` (
  `id` int(11) NOT NULL,
  `purchase_bill_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` decimal(18,4) NOT NULL,
  `unit_cost` decimal(18,4) NOT NULL DEFAULT 0.0000,
  `discount_pct` decimal(6,3) NOT NULL DEFAULT 0.000,
  `discount_amt` decimal(18,4) NOT NULL DEFAULT 0.0000,
  `tax_type` enum('EXCLUDE_VAT_7','INCLUDE_VAT_7','NO_VAT') NOT NULL DEFAULT 'EXCLUDE_VAT_7',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `manual_vat` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `purchase_bill_items`
--

INSERT INTO `purchase_bill_items` (`id`, `purchase_bill_id`, `product_id`, `qty`, `unit_cost`, `discount_pct`, `discount_amt`, `tax_type`, `created_at`, `updated_at`, `manual_vat`) VALUES
(1, 1, 32, 1000.0000, 500.0000, 0.000, 0.0000, 'EXCLUDE_VAT_7', '2026-03-20 12:09:55', '2026-03-20 12:09:55', NULL),
(2, 2, 31, 1000.0000, 150.0000, 0.000, 0.0000, 'EXCLUDE_VAT_7', '2026-03-20 12:28:14', '2026-03-20 12:28:14', NULL),
(3, 3, 30, 500.0000, 1000.0000, 0.000, 0.0000, 'EXCLUDE_VAT_7', '2026-03-20 12:28:57', '2026-03-20 12:28:57', NULL),
(4, 4, 31, 500.0000, 180.0000, 0.000, 0.0000, 'EXCLUDE_VAT_7', '2026-03-20 12:29:57', '2026-03-20 12:29:57', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `purchase_orders`
--

CREATE TABLE `purchase_orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `company_id` bigint(20) UNSIGNED NOT NULL,
  `po_no` varchar(50) NOT NULL,
  `vendor_id` bigint(20) UNSIGNED NOT NULL,
  `vendor_person_id` int(11) DEFAULT NULL,
  `vendor_person_prefix` varchar(20) DEFAULT NULL,
  `vendor_person_first_name` varchar(70) DEFAULT NULL,
  `vendor_person_last_name` varchar(70) DEFAULT NULL,
  `vendor_person_nickname` varchar(50) DEFAULT NULL,
  `vendor_person_email` varchar(191) DEFAULT NULL,
  `vendor_person_phone` varchar(30) DEFAULT NULL,
  `vendor_person_position` varchar(80) DEFAULT NULL,
  `vendor_person_department` varchar(80) DEFAULT NULL,
  `warehouse_id` bigint(20) UNSIGNED NOT NULL,
  `status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `issue_date` date NOT NULL,
  `expected_date` date DEFAULT NULL,
  `note` text DEFAULT NULL,
  `extra_charge_amt` decimal(12,2) NOT NULL DEFAULT 0.00,
  `extra_charge_note` varchar(255) DEFAULT NULL,
  `header_discount_type` enum('PERCENT','AMOUNT') DEFAULT NULL,
  `header_discount_value` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `cancelled_by` bigint(20) UNSIGNED DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_manual` tinyint(1) NOT NULL DEFAULT 0,
  `vendor_shipping_contact_name` varchar(150) DEFAULT NULL,
  `vendor_shipping_address_line` varchar(255) DEFAULT NULL,
  `vendor_shipping_subdistrict` varchar(150) DEFAULT NULL,
  `vendor_shipping_district` varchar(150) DEFAULT NULL,
  `vendor_shipping_province` varchar(150) DEFAULT NULL,
  `vendor_shipping_postcode` varchar(20) DEFAULT NULL,
  `vendor_registered_contact_name` varchar(150) DEFAULT NULL,
  `vendor_registered_address_line` varchar(255) DEFAULT NULL,
  `vendor_registered_subdistrict` varchar(150) DEFAULT NULL,
  `vendor_registered_district` varchar(150) DEFAULT NULL,
  `vendor_registered_province` varchar(150) DEFAULT NULL,
  `vendor_registered_postcode` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `purchase_orders`
--

INSERT INTO `purchase_orders` (`id`, `company_id`, `po_no`, `vendor_id`, `vendor_person_id`, `vendor_person_prefix`, `vendor_person_first_name`, `vendor_person_last_name`, `vendor_person_nickname`, `vendor_person_email`, `vendor_person_phone`, `vendor_person_position`, `vendor_person_department`, `warehouse_id`, `status`, `issue_date`, `expected_date`, `note`, `extra_charge_amt`, `extra_charge_note`, `header_discount_type`, `header_discount_value`, `created_by`, `approved_by`, `approved_at`, `cancelled_by`, `cancelled_at`, `cancel_reason`, `created_at`, `updated_at`, `is_manual`, `vendor_shipping_contact_name`, `vendor_shipping_address_line`, `vendor_shipping_subdistrict`, `vendor_shipping_district`, `vendor_shipping_province`, `vendor_shipping_postcode`, `vendor_registered_contact_name`, `vendor_registered_address_line`, `vendor_registered_subdistrict`, `vendor_registered_district`, `vendor_registered_province`, `vendor_registered_postcode`) VALUES
(1, 1, 'PO202603-0001', 7, 14, 'คุณ', 'สมปอง', 'ค้าขายดี', 'ปอง', 'sompong@supplier-a.com', '089-111-2222', 'ผู้จัดการฝ่ายขาย', 'ฝ่ายขาย', 3, 'APPROVED', '2026-03-20', '2026-03-20', NULL, 10000.00, 'ค่าขนส่ง', 'AMOUNT', 1000.00, 5, 5, '2026-03-20 19:08:29', NULL, NULL, NULL, '2026-03-20 19:08:21', '2026-03-20 19:08:29', 0, 'คุณสมปอง (ฝ่ายบัญชี)', '123 อาคารเอ ชั้น 5 ซ.สุขุมวิท 21', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 'คุณสมปอง', '123 อาคารเอ ชั้น 5 ซ.สุขุมวิท 21', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110'),
(2, 1, 'PO202603-0002', 8, 6, 'คุณ', 'สมหญิง', 'ใจดี', 'หญิง', 'somying@customer-b.com', '081-333-4444', 'หัวหน้าจัดซื้อ', 'จัดซื้อ', 4, 'CANCELLED', '2026-03-20', '2026-03-20', NULL, 0.00, NULL, 'AMOUNT', 0.00, 7, 7, '2026-03-20 19:28:12', 7, '2026-03-20 19:29:23', 'errorrr', '2026-03-20 19:28:10', '2026-03-20 19:29:23', 0, 'แผนกรับวางบิล', '88/9 หมู่ 5', 'บางโฉลง', 'บางพลี', 'สมุทรปราการ', '10540', 'คุณสมหญิง', '456 ถนนสีลม', 'สีลม', 'บางรัก', 'กรุงเทพมหานคร', '10500'),
(3, 1, 'PO202603-0003', 9, 7, 'นาย', 'สมชาย', 'รักการค้า', 'ชาย', 'somchai@gmail.com', '081-999-8888', 'เจ้าของกิจการ', 'บริหาร', 4, 'APPROVED', '2026-03-20', '2026-03-20', NULL, 0.00, NULL, 'AMOUNT', 0.00, 7, 7, '2026-03-20 19:28:48', NULL, NULL, NULL, '2026-03-20 19:28:46', '2026-03-20 19:28:48', 0, NULL, NULL, NULL, NULL, NULL, NULL, 'สมชาย รักการค้า', '789 ซอยลาดพร้าว 1', 'จอมพล', 'จตุจักร', 'กรุงเทพมหานคร', '10900'),
(4, 1, 'PO202603-0004', 8, 6, 'คุณ', 'สมหญิง', 'ใจดี', 'หญิง', 'somying@customer-b.com', '081-333-4444', 'หัวหน้าจัดซื้อ', 'จัดซื้อ', 4, 'APPROVED', '2026-03-20', '2026-03-20', NULL, 0.00, NULL, 'AMOUNT', 0.00, 7, 7, '2026-03-20 19:29:50', NULL, NULL, NULL, '2026-03-20 19:29:48', '2026-03-20 19:29:50', 0, 'แผนกรับวางบิล', '88/9 หมู่ 5', 'บางโฉลง', 'บางพลี', 'สมุทรปราการ', '10540', 'คุณสมหญิง', '456 ถนนสีลม', 'สีลม', 'บางรัก', 'กรุงเทพมหานคร', '10500');

-- --------------------------------------------------------

--
-- Table structure for table `purchase_order_items`
--

CREATE TABLE `purchase_order_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `purchase_order_id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `qty` int(11) NOT NULL,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount_pct` decimal(9,2) NOT NULL DEFAULT 0.00,
  `discount_amt` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_type` enum('EXCLUDE_VAT_7','INCLUDE_VAT_7','NO_VAT') NOT NULL DEFAULT 'EXCLUDE_VAT_7',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `manual_vat` decimal(10,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `purchase_order_items`
--

INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `product_id`, `qty`, `unit_cost`, `discount_pct`, `discount_amt`, `tax_type`, `created_at`, `updated_at`, `manual_vat`) VALUES
(1, 1, 32, 1000, 500.00, 0.00, 0.00, 'EXCLUDE_VAT_7', '2026-03-20 19:08:21', '2026-03-20 19:08:21', NULL),
(2, 2, 31, 1000, 150.00, 0.00, 0.00, 'EXCLUDE_VAT_7', '2026-03-20 19:28:10', '2026-03-20 19:28:10', NULL),
(3, 3, 30, 500, 1000.00, 0.00, 0.00, 'EXCLUDE_VAT_7', '2026-03-20 19:28:46', '2026-03-20 19:28:46', NULL),
(4, 4, 31, 500, 180.00, 0.00, 0.00, 'EXCLUDE_VAT_7', '2026-03-20 19:29:48', '2026-03-20 19:29:48', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `refresh_tokens`
--

INSERT INTO `refresh_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`) VALUES
(1, 1, 'ed03cfa6d617bf6d5de178a0d2debe798180cda8f0a1a74cfbc26c61898f7513', '2026-04-19 17:38:51', NULL, '2026-03-20 10:38:51'),
(2, 1, '56385f1f33e3ff2f619c1930fc40288b6564241c57c5f4c891ca62b4e9420984', '2026-04-19 17:44:25', NULL, '2026-03-20 10:44:25'),
(3, 1, 'b84bb04d23495a2b0b70fa31ad3fa2cdb69bd651e2f357b116219462aa07ddac', '2026-04-19 17:46:42', NULL, '2026-03-20 10:46:42'),
(4, 1, 'c78a8b31f316babfc3c94b3f8c93c9e9ac1a88cea283d6ba7cf878902b33b0cc', '2026-04-19 18:12:38', NULL, '2026-03-20 11:12:38'),
(5, 2, 'd54cfb9f57fcf240d7cede249636c7ed9de00735e976046bf3a1f2994a8dc603', '2026-04-19 18:13:03', NULL, '2026-03-20 11:13:03'),
(6, 1, '724a7d3fb4386b9f5ff90dd8ed6c9a81cdac395961caa9316ead60038059671c', '2026-04-19 18:18:02', NULL, '2026-03-20 11:18:02'),
(7, 2, '0eb2f291b3e468daca415201aecc56b05538a3bdcc2090c5b344328b70460ad8', '2026-04-19 18:27:26', NULL, '2026-03-20 11:27:26'),
(8, 2, '67bf2da1611a308f4dfc6f798b2dd338ebf63568f43d2fa8e275e8aa7ff6e9e4', '2026-04-19 18:34:08', NULL, '2026-03-20 11:34:08'),
(9, 2, 'e2cadd05ed916bd3f1f591aaac7b9e228be477c4594f9ac47172ed3d98d39793', '2026-04-19 18:49:44', NULL, '2026-03-20 11:49:44'),
(10, 5, '480ec9408489a73b92c4c463d91cac97535d60cebeaebd6da29df5cf1755e848', '2026-04-19 18:52:16', NULL, '2026-03-20 11:52:16'),
(11, 2, '5277eab9e8db5098e0a4c545c1cc0866950eb67addefa62809a9ec4f26acf68b', '2026-04-19 19:06:56', NULL, '2026-03-20 12:06:56'),
(12, 5, '14ab6307e9aaf37c8b96415717c3bb780c3563645bae0feaf257b27bfad61c44', '2026-04-19 19:07:30', NULL, '2026-03-20 12:07:30'),
(13, 5, '09732e7e95101e7f01a92c149590b74fba3aae82dbe3cc3ba45148357e7e815b', '2026-04-19 19:23:29', NULL, '2026-03-20 12:23:29'),
(14, 6, 'e1afb96b6451c17c0ea2f2be2f78ca985f565c6a27bc8f37a02c28be6bca15b1', '2026-04-19 19:25:27', NULL, '2026-03-20 12:25:27'),
(15, 7, 'f50b271bc20f4b66128b62acc043048e0644fe3ca27d1c52a57e77867b460c09', '2026-04-19 19:26:56', NULL, '2026-03-20 12:26:56'),
(16, 4, 'fd8bd2770bc147571786126b9df0d7ce3f31238c36bda1c0faff5f569278ab15', '2026-04-19 19:39:18', NULL, '2026-03-20 12:39:18'),
(17, 4, '25fcdf5d5c1be8eca5ccfdc8514eb9d357f7e58246dff952d2793133b365e584', '2026-04-19 19:43:36', NULL, '2026-03-20 12:43:36'),
(18, 4, 'fb9c70850241e768efa75fb766f54d6a6be5abc792d6ea651a6fa9b356c78d10', '2026-04-19 20:23:30', NULL, '2026-03-20 13:23:30'),
(19, 2, 'e3923ec36e7e50f00c0e687171d03a07dba990dbc11603e2ff2ed2900d2a899a', '2026-04-19 20:27:06', NULL, '2026-03-20 13:27:06'),
(20, 1, '8f6746c2f33891732e1bdba1c0d41a1af0b0da2310db86dbb1dee460ac03443a', '2026-04-19 20:27:18', NULL, '2026-03-20 13:27:18'),
(21, 2, '359ba8fc33852f2f1eb83bb574b6fad1214c72698ca584c1667578f912f4f163', '2026-04-19 20:37:10', NULL, '2026-03-20 13:37:10');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `company_id`, `code`, `name`, `is_system`, `is_active`, `created_at`) VALUES
(1, NULL, 'system_owner', 'System Owner', 1, 1, '2026-02-03 07:07:29'),
(2, NULL, 'company_admin', 'Company Admin', 0, 1, '2026-02-03 07:55:29'),
(3, NULL, 'company_user', 'Company User', 0, 1, '2026-02-05 22:39:27'),
(5, NULL, 'company_owner', 'เจ้าของบริษัท (Company Owner)', 0, 1, '2026-03-20 10:55:50'),
(6, NULL, 'company_manage', 'ผู้จัดการ (Manager)', 0, 1, '2026-03-20 10:55:50'),
(7, 1, 'company_admin', 'Company Admin', 0, 1, '2026-03-20 11:43:04'),
(8, 1, 'company_user', 'Company User', 0, 1, '2026-03-20 11:43:04'),
(9, 1, 'company_owner', 'เจ้าของบริษัท (Company Owner)', 0, 1, '2026-03-20 11:43:04'),
(10, 1, 'company_manage', 'ผู้จัดการ (Manager)', 0, 1, '2026-03-20 11:43:04');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role_id`, `permission_id`, `created_at`) VALUES
(1, 1, '2026-03-20 11:23:39'),
(1, 2, '2026-03-20 11:23:39'),
(1, 3, '2026-03-20 11:23:39'),
(1, 4, '2026-03-20 11:23:39'),
(1, 5, '2026-03-20 11:23:39'),
(1, 6, '2026-03-20 11:23:39'),
(1, 7, '2026-03-20 11:23:39'),
(1, 8, '2026-03-20 11:23:39'),
(1, 9, '2026-03-20 11:23:39'),
(1, 10, '2026-03-20 11:23:39'),
(1, 11, '2026-03-20 11:23:39'),
(1, 12, '2026-03-20 11:23:39'),
(1, 13, '2026-03-20 11:23:39'),
(1, 14, '2026-03-20 11:23:39'),
(1, 15, '2026-03-20 11:23:39'),
(2, 1, '2026-02-03 07:55:29'),
(2, 2, '2026-02-03 07:55:29'),
(2, 3, '2026-02-03 07:55:29'),
(2, 4, '2026-02-03 07:55:29'),
(2, 5, '2026-02-03 07:55:29'),
(2, 6, '2026-02-03 07:55:29'),
(2, 7, '2026-02-03 07:55:29'),
(2, 8, '2026-02-03 07:55:29'),
(2, 9, '2026-02-03 07:55:29'),
(2, 10, '2026-02-03 07:55:29'),
(2, 11, '2026-02-03 07:55:29'),
(2, 12, '2026-02-03 10:16:34'),
(2, 13, '2026-02-03 17:27:58'),
(2, 14, '2026-02-12 10:04:38'),
(2, 15, '2026-03-05 14:48:21'),
(3, 6, '2026-02-05 23:01:07'),
(3, 7, '2026-02-05 23:01:07'),
(3, 8, '2026-02-05 23:01:07'),
(3, 9, '2026-02-05 23:01:07'),
(3, 10, '2026-02-05 23:01:07'),
(3, 11, '2026-02-05 23:01:07'),
(3, 12, '2026-02-05 23:01:07'),
(3, 13, '2026-02-05 23:01:07'),
(3, 14, '2026-02-12 10:05:03'),
(3, 15, '2026-03-05 14:48:21'),
(5, 1, '2026-03-20 11:26:25'),
(5, 2, '2026-03-20 11:26:25'),
(5, 3, '2026-03-20 11:26:25'),
(5, 4, '2026-03-20 11:26:25'),
(5, 5, '2026-03-20 11:26:25'),
(5, 6, '2026-03-20 11:26:25'),
(5, 7, '2026-03-20 11:26:25'),
(5, 8, '2026-03-20 11:26:25'),
(5, 9, '2026-03-20 11:26:25'),
(5, 10, '2026-03-20 11:26:25'),
(5, 11, '2026-03-20 11:26:25'),
(5, 12, '2026-03-20 11:26:25'),
(5, 13, '2026-03-20 11:26:25'),
(5, 14, '2026-03-20 11:26:25'),
(5, 15, '2026-03-20 11:26:25'),
(7, 1, '2026-03-20 11:43:04'),
(7, 2, '2026-03-20 11:43:04'),
(7, 3, '2026-03-20 11:43:04'),
(7, 4, '2026-03-20 11:43:04'),
(7, 5, '2026-03-20 11:43:04'),
(7, 6, '2026-03-20 11:43:04'),
(7, 7, '2026-03-20 11:43:04'),
(7, 8, '2026-03-20 11:43:04'),
(7, 9, '2026-03-20 11:43:04'),
(7, 10, '2026-03-20 11:43:04'),
(7, 11, '2026-03-20 11:43:04'),
(7, 12, '2026-03-20 11:43:04'),
(7, 13, '2026-03-20 11:43:04'),
(7, 14, '2026-03-20 11:43:04'),
(7, 15, '2026-03-20 11:43:04'),
(8, 6, '2026-03-20 11:43:04'),
(8, 7, '2026-03-20 11:43:04'),
(8, 8, '2026-03-20 11:43:04'),
(8, 9, '2026-03-20 11:43:04'),
(8, 10, '2026-03-20 11:43:04'),
(8, 11, '2026-03-20 11:43:04'),
(8, 12, '2026-03-20 11:43:04'),
(8, 13, '2026-03-20 11:43:04'),
(8, 14, '2026-03-20 11:43:04'),
(8, 15, '2026-03-20 11:43:04'),
(9, 1, '2026-03-20 11:43:04'),
(9, 2, '2026-03-20 11:43:04'),
(9, 3, '2026-03-20 11:43:04'),
(9, 4, '2026-03-20 11:43:04'),
(9, 5, '2026-03-20 11:43:04'),
(9, 6, '2026-03-20 11:43:04'),
(9, 7, '2026-03-20 11:43:04'),
(9, 8, '2026-03-20 11:43:04'),
(9, 9, '2026-03-20 11:43:04'),
(9, 10, '2026-03-20 11:43:04'),
(9, 11, '2026-03-20 11:43:04'),
(9, 12, '2026-03-20 11:43:04'),
(9, 13, '2026-03-20 11:43:04'),
(9, 14, '2026-03-20 11:43:04'),
(9, 15, '2026-03-20 11:43:04'),
(10, 1, '2026-03-20 11:48:24'),
(10, 2, '2026-03-20 11:48:24'),
(10, 3, '2026-03-20 11:48:24'),
(10, 4, '2026-03-20 11:48:24'),
(10, 5, '2026-03-20 11:48:24'),
(10, 6, '2026-03-20 11:48:24'),
(10, 7, '2026-03-20 11:48:24'),
(10, 8, '2026-03-20 11:48:24'),
(10, 9, '2026-03-20 11:48:24'),
(10, 10, '2026-03-20 11:48:24'),
(10, 11, '2026-03-20 11:48:24'),
(10, 12, '2026-03-20 11:48:24'),
(10, 13, '2026-03-20 11:48:24'),
(10, 14, '2026-03-20 11:48:24'),
(10, 15, '2026-03-20 11:48:24');

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `invoice_no` varchar(50) DEFAULT NULL,
  `quotation_no` varchar(50) DEFAULT NULL,
  `quotation_date` datetime DEFAULT NULL,
  `tax_invoice_no` varchar(50) DEFAULT NULL,
  `tax_invoice_date` datetime DEFAULT NULL,
  `receipt_no` varchar(50) DEFAULT NULL,
  `receipt_date` datetime DEFAULT NULL,
  `delivery_no` varchar(50) DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `seller_id` int(11) DEFAULT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) NOT NULL,
  `status` enum('DRAFT','QUOTATION','CONFIRMED','SHIPPED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `payment_status` enum('UNPAID','PARTIAL','PAID') NOT NULL DEFAULT 'UNPAID',
  `issue_date` date NOT NULL,
  `valid_until` date DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `subtotal` decimal(14,2) NOT NULL DEFAULT 0.00,
  `tax` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `commission_paid` tinyint(1) NOT NULL DEFAULT 0,
  `commission_payment_id` int(11) DEFAULT NULL,
  `paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `balance_due` decimal(14,2) NOT NULL DEFAULT 0.00,
  `withholding_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `net_after_withholding` decimal(14,2) NOT NULL DEFAULT 0.00,
  `stock_deducted_at` enum('INVOICE','SHIPMENT','MANUAL') DEFAULT 'INVOICE',
  `deposit` decimal(14,2) NOT NULL DEFAULT 0.00,
  `cogs_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_by` int(11) DEFAULT NULL,
  `confirmed_by` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `shipped_by` int(11) DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_stage` varchar(50) DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `is_manual` tinyint(1) NOT NULL DEFAULT 0,
  `finance_account_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`id`, `company_id`, `invoice_no`, `quotation_no`, `quotation_date`, `tax_invoice_no`, `tax_invoice_date`, `receipt_no`, `receipt_date`, `delivery_no`, `delivery_date`, `seller_id`, `customer_id`, `warehouse_id`, `status`, `payment_status`, `issue_date`, `valid_until`, `note`, `subtotal`, `tax`, `total`, `commission_paid`, `commission_payment_id`, `paid_amount`, `balance_due`, `withholding_total`, `net_after_withholding`, `stock_deducted_at`, `deposit`, `cogs_total`, `created_by`, `confirmed_by`, `confirmed_at`, `shipped_by`, `shipped_at`, `approved_by`, `approved_at`, `created_at`, `updated_at`, `cancelled_by`, `cancelled_at`, `cancel_stage`, `cancel_reason`, `is_manual`, `finance_account_id`) VALUES
(1, 1, 'IV202603-0001', 'QT202603-0001', '2026-03-20 00:00:00', 'TAX202603-0001', '2026-03-20 19:20:52', 'RE202603-0001', '2026-03-20 19:21:04', 'DO202603-0001', '2026-03-20 19:20:55', 5, 9, 3, 'SHIPPED', 'PAID', '2026-03-20', '2026-03-20', NULL, 100000.00, 7000.00, 107000.00, 0, NULL, 107000.00, 0.00, 0.00, 107000.00, 'INVOICE', 0.00, 100000.00, 5, 5, '2026-03-20 19:20:52', 5, '2026-03-20 19:20:55', NULL, NULL, '2026-03-20 12:18:29', '2026-03-20 12:21:04', NULL, NULL, NULL, NULL, 0, 3),
(2, 1, 'IV202603-0002', 'QT202603-0002', '2026-03-20 00:00:00', 'TAX202603-0002', '2026-03-20 19:24:56', 'RE202603-0002', '2026-03-20 19:25:01', 'DO202603-0002', '2026-03-20 19:24:57', 5, 8, 3, 'SHIPPED', 'PAID', '2026-03-20', '2026-03-20', NULL, 100000.00, 7000.00, 107000.00, 0, NULL, 107000.00, 0.00, 0.00, 107000.00, 'INVOICE', 0.00, 50000.00, 5, 5, '2026-03-20 19:24:56', 5, '2026-03-20 19:24:57', NULL, NULL, '2026-03-20 12:24:54', '2026-03-20 12:25:01', NULL, NULL, NULL, NULL, 0, 3),
(3, 1, 'IV202603-0003', 'QT202603-0003', '2026-03-20 00:00:00', 'TAX202603-0003', '2026-03-20 19:26:01', 'RE202603-0003', '2026-03-20 19:26:08', 'DO202603-0003', '2026-03-20 19:26:03', 6, 9, 3, 'SHIPPED', 'PAID', '2026-03-20', '2026-03-20', NULL, 100000.00, 7000.00, 107000.00, 1, 2, 107000.00, 0.00, 0.00, 107000.00, 'INVOICE', 0.00, 5000.00, 6, 6, '2026-03-20 19:26:01', 6, '2026-03-20 19:26:03', NULL, NULL, '2026-03-20 12:25:58', '2026-03-20 13:24:10', NULL, NULL, NULL, NULL, 0, 1),
(4, 1, 'IV202603-0004', 'QT202603-0004', '2026-03-20 00:00:00', 'TAX202603-0004', '2026-03-20 19:27:28', 'RE202603-0004', '2026-03-20 19:27:32', 'DO202603-0004', '2026-03-20 19:27:29', 7, 9, 3, 'SHIPPED', 'PAID', '2026-03-20', '2026-03-20', NULL, 45000.00, 3150.00, 48150.00, 1, 1, 48150.00, 0.00, 0.00, 48150.00, 'INVOICE', 0.00, 45000.00, 7, 7, '2026-03-20 19:27:28', 7, '2026-03-20 19:27:29', NULL, NULL, '2026-03-20 12:27:25', '2026-03-20 12:44:40', NULL, NULL, NULL, NULL, 0, 1),
(5, 1, 'IV202603-0005', 'QT202603-0005', '2026-03-20 00:00:00', 'TAX202603-0005', '2026-03-20 19:30:42', 'RE202603-0005', '2026-03-20 19:30:47', 'DO202603-0005', '2026-03-20 19:30:43', 7, 9, 4, 'SHIPPED', 'PAID', '2026-03-20', '2026-03-20', NULL, 200000.00, 14000.00, 214000.00, 1, 1, 214000.00, 0.00, 0.00, 214000.00, 'INVOICE', 0.00, 15000.00, 7, 7, '2026-03-20 19:30:42', 7, '2026-03-20 19:30:43', NULL, NULL, '2026-03-20 12:30:40', '2026-03-20 12:44:40', NULL, NULL, NULL, NULL, 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `sales_items`
--

CREATE TABLE `sales_items` (
  `id` bigint(20) NOT NULL,
  `sales_id` bigint(20) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price` decimal(14,2) NOT NULL,
  `discount_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `vat_mode` enum('EXCL','INCL','NONE') NOT NULL DEFAULT 'EXCL',
  `vat_rate` decimal(5,2) NOT NULL DEFAULT 7.00,
  `amount_before_vat` decimal(14,2) NOT NULL DEFAULT 0.00,
  `vat_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `commission_mode` enum('PERCENT','AMOUNT') NOT NULL DEFAULT 'PERCENT',
  `commission_value` decimal(14,2) NOT NULL DEFAULT 0.00,
  `commission_per_unit` decimal(14,2) NOT NULL DEFAULT 0.00,
  `commission_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `withholding_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `withholding_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total` decimal(14,2) NOT NULL,
  `cogs_total` decimal(14,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales_items`
--

INSERT INTO `sales_items` (`id`, `sales_id`, `product_id`, `quantity`, `price`, `discount_percent`, `discount_amount`, `discount_total`, `vat_mode`, `vat_rate`, `amount_before_vat`, `vat_amount`, `commission_mode`, `commission_value`, `commission_per_unit`, `commission_total`, `withholding_rate`, `withholding_amount`, `total`, `cogs_total`) VALUES
(1, 1, 32, 200, 500.00, 0.00, 0.00, 0.00, 'EXCL', 7.00, 100000.00, 7000.00, 'PERCENT', 5.00, 25.00, 5000.00, 0.00, 0.00, 107000.00, 100000.00),
(2, 2, 32, 100, 1000.00, 0.00, 0.00, 0.00, 'EXCL', 7.00, 100000.00, 7000.00, 'PERCENT', 5.00, 50.00, 5000.00, 0.00, 0.00, 107000.00, 50000.00),
(3, 3, 32, 10, 10000.00, 0.00, 0.00, 0.00, 'EXCL', 7.00, 100000.00, 7000.00, 'PERCENT', 5.00, 500.00, 5000.00, 0.00, 0.00, 107000.00, 5000.00),
(4, 4, 32, 90, 500.00, 0.00, 0.00, 0.00, 'EXCL', 7.00, 45000.00, 3150.00, 'PERCENT', 2.00, 10.00, 900.00, 0.00, 0.00, 48150.00, 45000.00),
(5, 5, 31, 100, 2000.00, 0.00, 0.00, 0.00, 'EXCL', 7.00, 200000.00, 14000.00, 'PERCENT', 5.00, 100.00, 10000.00, 0.00, 0.00, 214000.00, 15000.00);

-- --------------------------------------------------------

--
-- Table structure for table `stock_adjustments`
--

CREATE TABLE `stock_adjustments` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `doc_no` varchar(40) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `reason` varchar(255) DEFAULT NULL,
  `cogs_total` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `cancel_stage` varchar(50) DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_adjustment_items`
--

CREATE TABLE `stock_adjustment_items` (
  `id` bigint(20) NOT NULL,
  `adjustment_id` bigint(20) NOT NULL,
  `product_id` int(11) NOT NULL,
  `direction` enum('IN','OUT') NOT NULL,
  `qty` int(11) NOT NULL,
  `unit_cost` decimal(14,6) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_counts`
--

CREATE TABLE `stock_counts` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `doc_no` varchar(40) NOT NULL,
  `issue_date` date NOT NULL,
  `status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `warehouse_id` int(11) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `adjustment_id` bigint(20) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `approved_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_count_items`
--

CREATE TABLE `stock_count_items` (
  `id` bigint(20) NOT NULL,
  `count_id` bigint(20) NOT NULL,
  `product_id` int(11) NOT NULL,
  `system_qty` decimal(14,4) NOT NULL DEFAULT 0.0000,
  `counted_qty` decimal(14,4) NOT NULL DEFAULT 0.0000,
  `variance_qty` decimal(14,4) GENERATED ALWAYS AS (`counted_qty` - `system_qty`) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_lots`
--

CREATE TABLE `stock_lots` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `ref_type` varchar(30) NOT NULL,
  `ref_id` bigint(20) NOT NULL,
  `received_date` date NOT NULL,
  `unit_cost` decimal(14,6) NOT NULL,
  `qty_in` int(11) NOT NULL,
  `qty_out` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_lots`
--

INSERT INTO `stock_lots` (`id`, `company_id`, `product_id`, `warehouse_id`, `ref_type`, `ref_id`, `received_date`, `unit_cost`, `qty_in`, `qty_out`, `created_at`) VALUES
(1, 1, 32, 3, 'GRN', 1, '2026-03-20', 500.000000, 1000, 400, '2026-03-20 12:17:42'),
(2, 1, 31, 4, 'GRN', 2, '2026-03-20', 150.000000, 1000, 100, '2026-03-20 12:28:24'),
(3, 1, 30, 4, 'GRN', 3, '2026-03-20', 1000.000000, 500, 0, '2026-03-20 12:29:02'),
(4, 1, 31, 4, 'GRN', 4, '2026-03-20', 180.000000, 500, 0, '2026-03-20 12:30:02');

-- --------------------------------------------------------

--
-- Table structure for table `stock_lot_moves`
--

CREATE TABLE `stock_lot_moves` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `lot_id` bigint(20) NOT NULL,
  `ref_type` varchar(30) NOT NULL,
  `ref_id` bigint(20) NOT NULL,
  `qty` int(11) NOT NULL,
  `unit_cost` decimal(14,6) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_lot_moves`
--

INSERT INTO `stock_lot_moves` (`id`, `company_id`, `lot_id`, `ref_type`, `ref_id`, `qty`, `unit_cost`, `created_at`) VALUES
(1, 1, 1, 'GRN', 1, 1000, 500.000000, '2026-03-20 12:17:42'),
(2, 1, 1, 'SALE', 1, 200, 500.000000, '2026-03-20 12:20:52'),
(3, 1, 1, 'SALE', 2, 100, 500.000000, '2026-03-20 12:24:56'),
(4, 1, 1, 'SALE', 3, 10, 500.000000, '2026-03-20 12:26:01'),
(5, 1, 1, 'SALE', 4, 90, 500.000000, '2026-03-20 12:27:28'),
(6, 1, 2, 'GRN', 2, 1000, 150.000000, '2026-03-20 12:28:24'),
(7, 1, 3, 'GRN', 3, 500, 1000.000000, '2026-03-20 12:29:02'),
(8, 1, 4, 'GRN', 4, 500, 180.000000, '2026-03-20 12:30:02'),
(9, 1, 2, 'SALE', 5, 100, 150.000000, '2026-03-20 12:30:42');

-- --------------------------------------------------------

--
-- Table structure for table `stock_moves`
--

CREATE TABLE `stock_moves` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `ref_type` varchar(30) NOT NULL,
  `ref_id` bigint(20) NOT NULL,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `move_type` enum('IN','OUT') NOT NULL,
  `qty` int(11) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_moves`
--

INSERT INTO `stock_moves` (`id`, `company_id`, `ref_type`, `ref_id`, `product_id`, `warehouse_id`, `move_type`, `qty`, `note`, `created_by`, `created_at`) VALUES
(1, 1, 'GRN', 1, 32, 3, 'IN', 1000, NULL, 5, '2026-03-20 12:17:42'),
(2, 1, 'SALE', 1, 32, 3, 'OUT', 200, NULL, 5, '2026-03-20 12:20:52'),
(3, 1, 'SALE', 2, 32, 3, 'OUT', 100, NULL, 5, '2026-03-20 12:24:56'),
(4, 1, 'SALE', 3, 32, 3, 'OUT', 10, NULL, 6, '2026-03-20 12:26:01'),
(5, 1, 'SALE', 4, 32, 3, 'OUT', 90, NULL, 7, '2026-03-20 12:27:28'),
(6, 1, 'GRN', 2, 31, 4, 'IN', 1000, NULL, 7, '2026-03-20 12:28:24'),
(7, 1, 'GRN', 3, 30, 4, 'IN', 500, NULL, 7, '2026-03-20 12:29:02'),
(8, 1, 'GRN', 4, 31, 4, 'IN', 500, NULL, 7, '2026-03-20 12:30:02'),
(9, 1, 'SALE', 5, 31, 4, 'OUT', 100, NULL, 7, '2026-03-20 12:30:42');

-- --------------------------------------------------------

--
-- Table structure for table `stock_transfers`
--

CREATE TABLE `stock_transfers` (
  `id` bigint(20) NOT NULL,
  `company_id` int(11) NOT NULL,
  `doc_no` varchar(40) NOT NULL,
  `issue_date` date NOT NULL,
  `status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `source_warehouse_id` int(11) NOT NULL,
  `target_warehouse_id` int(11) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `cancelled_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `approved_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transfer_items`
--

CREATE TABLE `stock_transfer_items` (
  `id` bigint(20) NOT NULL,
  `transfer_id` bigint(20) NOT NULL,
  `product_id` int(11) NOT NULL,
  `qty` decimal(14,4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `stock_transfer_items`
--

INSERT INTO `stock_transfer_items` (`id`, `transfer_id`, `product_id`, `qty`) VALUES
(1, 1, 5, 100.0000),
(2, 5, 5, 50.0000);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(30) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(150) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `company_id`, `first_name`, `last_name`, `phone`, `email`, `password_hash`, `display_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, NULL, 'System', 'Owner', '0800000000', 'owner@system.com', '$2b$10$HPkeQ9WdbnM1xCeFbDb7CeVAvmR4dHW56nsCx3E2Q5/tZhhrK.236', NULL, 1, '2026-02-03 07:51:17', '2026-03-20 10:38:23'),
(2, 1, 'OwnerStark', 'Company', '09090909090', 'test123@example.com', '$2b$10$7PP7aW3/AmMmPEGagKcsAOs7TNPfn4eIfi9RhIVvvvvYHoUsEsolq', 'OwnerStark', 1, '2026-03-20 10:56:46', '2026-03-20 10:56:46'),
(3, 1, 'AdminStark', 'Company', '090909090', 'AdminStark@example.com', '$2b$10$i2axKf94xCK3pC5yn/dtHe.yiHrC86Nf2mTvf/DQ1EMyUmep5inwy', 'AdminStark', 1, '2026-03-20 10:59:07', '2026-03-20 10:59:07'),
(4, 1, 'ManageStark', 'Company', '12313132132131', 'ManageStark@example.com', '$2b$10$J3SjbBLWguakKOYehe7Ur.oZ0iQHVJAWDxrRQN7PhVZq2eduxf2uO', 'ManageStark', 1, '2026-03-20 10:59:58', '2026-03-20 10:59:58'),
(5, 1, 'UserStark', 'Company', '345325353', 'UserStark@Gmail.com', '$2b$10$7t5a/8TGPFwAfgrVs2kWRe4DeYmkSh1hgN0KP7fBLVRan8AcfmSE6', 'UserStark', 1, '2026-03-20 11:00:21', '2026-03-20 11:00:21'),
(6, 1, 'UserStark1', 'Company', '21342452342342', 'UserStark1@Gmail.com', '$2b$10$9p75/jT7dOHdi.k1ORL52ee4z1Rze0SQI/1Y15Oo4rllIuRd0ODo2', 'UserStark1', 1, '2026-03-20 11:50:12', '2026-03-20 11:50:12'),
(7, 1, 'UserStark2', 'Company', '2131321123', 'UserStark2@Gmail.com', '$2b$10$PSv7qP/MHmv//tWNX6OFfudFzWFm.adxFryFwik4Moj1f96uG..km', 'UserStark2', 1, '2026-03-20 11:51:03', '2026-03-20 11:51:03');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`, `created_at`) VALUES
(1, 1, '2026-03-20 10:38:23'),
(2, 9, '2026-03-20 11:43:04'),
(3, 7, '2026-03-20 11:43:04'),
(4, 10, '2026-03-20 11:43:04'),
(5, 8, '2026-03-20 11:43:04'),
(6, 8, '2026-03-20 11:50:22'),
(7, 8, '2026-03-20 11:51:07');

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `type` enum('VENDOR','CUSTOMER','BOTH') NOT NULL DEFAULT 'VENDOR',
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `tax_id` varchar(32) DEFAULT NULL,
  `tax_country` varchar(10) NOT NULL DEFAULT 'TH',
  `office_type` varchar(20) NOT NULL DEFAULT 'unknown',
  `legal_entity_type` varchar(20) NOT NULL DEFAULT 'corporate',
  `legal_form` varchar(30) DEFAULT NULL,
  `business_name` varchar(255) DEFAULT NULL,
  `person_first_name` varchar(100) DEFAULT NULL,
  `person_last_name` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `contacts_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`contacts_json`)),
  `banks_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`banks_json`)),
  `payment_term_type` varchar(20) NOT NULL DEFAULT 'by_days',
  `payment_due_days` int(11) NOT NULL DEFAULT 0,
  `payment_due_date` date DEFAULT NULL,
  `payment_month_day` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendors`
--

INSERT INTO `vendors` (`id`, `company_id`, `type`, `code`, `name`, `tax_id`, `tax_country`, `office_type`, `legal_entity_type`, `legal_form`, `business_name`, `person_first_name`, `person_last_name`, `phone`, `email`, `address`, `contacts_json`, `banks_json`, `payment_term_type`, `payment_due_days`, `payment_due_date`, `payment_month_day`, `is_active`, `created_at`, `updated_at`) VALUES
(7, 1, 'VENDOR', 'V-001', 'บริษัท ซัพพลายเออร์ เอ กรุ๊ป จำกัด', '0105560000001', 'TH', 'unknown', 'corporate', 'company_limited', 'บริษัท ซัพพลายเออร์ เอ กรุ๊ป จำกัด', NULL, NULL, '213131331213', 'info@supplier-a.com', '123 อาคารเอ ชั้น 5 ซ.สุขุมวิท 21', NULL, NULL, 'by_days', 0, NULL, NULL, 1, '2026-03-20 11:55:23', '2026-03-20 12:00:54'),
(8, 1, 'CUSTOMER', 'C-001', 'หจก. คัสตอมเมอร์ บี พลัส', '0103560000002', 'TH', 'branch', 'corporate', 'limited_partnership', 'คัสตอมเมอร์ บี พลัส', NULL, NULL, '02-333-4444', 'sales@customer-b.com', '456 ถ.สีลม เขตบางรัก กรุงเทพฯ 10500', NULL, NULL, 'by_days', 15, NULL, NULL, 1, '2026-03-20 11:55:23', '2026-03-20 11:55:23'),
(9, 1, 'BOTH', 'VC-001', 'นาย สมชาย รักการค้า', '3100000000003', 'TH', 'unknown', 'individual', NULL, NULL, 'สมชาย', 'รักการค้า', '081-999-8888', 'somchai@gmail.com', '789 ถ.ลาดพร้าว เขตจตุจักร กรุงเทพฯ 10900', NULL, NULL, 'by_month_day', 0, NULL, 25, 1, '2026-03-20 11:55:23', '2026-03-20 11:55:23'),
(10, 1, 'VENDOR', 'V-002', 'Global Tech Corp', 'US123456789', 'other', 'headquarter', 'corporate', 'foreign_juristic', 'Global Tech Corp', NULL, NULL, '+1-555-0198', 'hello@globaltech.com', '1 Silicon Way, CA 94025, USA', NULL, NULL, 'by_date', 0, '2026-12-31', NULL, 1, '2026-03-20 11:55:23', '2026-03-20 11:55:23');

-- --------------------------------------------------------

--
-- Table structure for table `vendor_addresses`
--

CREATE TABLE `vendor_addresses` (
  `id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `addr_type` enum('registered','shipping') NOT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `address_line` text DEFAULT NULL,
  `subdistrict` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postcode` varchar(20) DEFAULT NULL,
  `country` varchar(60) NOT NULL DEFAULT 'TH',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_addresses`
--

INSERT INTO `vendor_addresses` (`id`, `vendor_id`, `addr_type`, `contact_name`, `address_line`, `subdistrict`, `district`, `province`, `postcode`, `country`, `created_at`, `updated_at`) VALUES
(1, 3, 'registered', NULL, NULL, 'Test2', 'Test3', 'Test4', '11111', 'TH', '2026-02-09 16:27:39', '2026-02-09 16:27:39'),
(2, 3, 'shipping', NULL, NULL, 'af', 'faf', 'zxczc', '453243', 'TH', '2026-02-09 16:27:39', '2026-02-09 16:27:39'),
(3, 4, 'registered', 'ทดสอบเทส', 'ทดสอบที่อยู่', 'บางซื่อ', 'A', 'BV', '1230123', 'TH', '2026-02-09 16:54:56', '2026-02-09 16:54:56'),
(4, 4, 'shipping', 'Tawan', 'address', 'asdasd', 'fdsdfwsf1', 'BKk', '54356546', 'TH', '2026-02-09 16:54:56', '2026-02-09 16:54:56'),
(5, 5, 'registered', 'dasda', 'acaca', 'adafz', 'vzvzv', 'vzvzv', 'nnvnvn', 'TH', '2026-02-17 09:45:46', '2026-02-17 09:45:46'),
(6, 5, 'shipping', 'ที่อยู่จัดส่งเอกสาร', 'ที่อยู่จัดส่งเอกสาร', 'ที่อยู่จัดส่งเอกสาร', 'ที่อยู่จัดส่งเอกสาร', 'ที่อยู่จัดส่งเอกสาร', 'ที่อยู่จัด', 'TH', '2026-02-17 09:45:46', '2026-02-17 09:45:46'),
(7, 6, 'registered', 'TEST99', 'QWERTY', 'QWERTY', 'QWERTY', 'QWERTY', '12313', 'TH', '2026-02-17 10:04:54', '2026-02-17 10:04:54'),
(8, 6, 'shipping', 'QWERTY', 'QWERTY', 'QWERTY', 'QWERTY', 'QWERTY', '12313', 'TH', '2026-02-17 10:04:54', '2026-02-17 10:04:54'),
(11, 8, 'registered', 'คุณสมหญิง', '456 ถนนสีลม', 'สีลม', 'บางรัก', 'กรุงเทพมหานคร', '10500', 'TH', '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(12, 8, 'shipping', 'แผนกรับวางบิล', '88/9 หมู่ 5', 'บางโฉลง', 'บางพลี', 'สมุทรปราการ', '10540', 'TH', '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(13, 9, 'registered', 'สมชาย รักการค้า', '789 ซอยลาดพร้าว 1', 'จอมพล', 'จตุจักร', 'กรุงเทพมหานคร', '10900', 'TH', '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(14, 10, 'registered', 'John Doe', '1 Silicon Way, Palo Alto', 'Santa Clara', 'California', 'CA', '94025', 'US', '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(21, 7, 'registered', 'คุณสมปอง', '123 อาคารเอ ชั้น 5 ซ.สุขุมวิท 21', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 'TH', '2026-03-20 12:00:54', '2026-03-20 12:00:54'),
(22, 7, 'shipping', 'คุณสมปอง (ฝ่ายบัญชี)', '123 อาคารเอ ชั้น 5 ซ.สุขุมวิท 21', 'คลองเตยเหนือ', 'วัฒนา', 'กรุงเทพมหานคร', '10110', 'TH', '2026-03-20 12:00:54', '2026-03-20 12:00:54');

-- --------------------------------------------------------

--
-- Table structure for table `vendor_bank_accounts`
--

CREATE TABLE `vendor_bank_accounts` (
  `id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `bank_code` varchar(20) DEFAULT NULL,
  `bank_name` varchar(100) NOT NULL,
  `account_name` varchar(150) NOT NULL,
  `account_no` varchar(50) NOT NULL,
  `branch_code` varchar(20) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_bank_accounts`
--

INSERT INTO `vendor_bank_accounts` (`id`, `vendor_id`, `bank_code`, `bank_name`, `account_name`, `account_no`, `branch_code`, `is_default`, `sort_order`, `created_at`, `updated_at`) VALUES
(7, 8, '002', 'ธนาคารกรุงเทพ', 'หจก. คัสตอมเมอร์ บี พลัส', '111-2-22222-3', 'สาขาสีลม', 1, 1, '2026-03-20 11:58:51', '2026-03-20 11:58:51'),
(8, 9, '006', 'ธนาคารกรุงไทย', 'นาย สมชาย รักการค้า', '444-5-55555-6', 'สาขาลาดพร้าว', 1, 1, '2026-03-20 11:58:51', '2026-03-20 11:58:51'),
(9, 10, 'CITI', 'Citibank', 'Global Tech Corp', '000-111-222-333', 'US-NY', 1, 1, '2026-03-20 11:58:51', '2026-03-20 11:58:51'),
(12, 8, '002', 'ธนาคารกรุงเทพ', 'หจก. คัสตอมเมอร์ บี พลัส', '111-2-22222-3', 'สาขาสีลม', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(13, 9, '006', 'ธนาคารกรุงไทย', 'นาย สมชาย รักการค้า', '444-5-55555-6', 'สาขาลาดพร้าว', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(14, 10, 'CITI', 'Citibank', 'Global Tech Corp', '000-111-222-333', 'US-NY', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22');

-- --------------------------------------------------------

--
-- Table structure for table `vendor_contacts`
--

CREATE TABLE `vendor_contacts` (
  `id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `label` varchar(100) DEFAULT NULL,
  `channel` varchar(50) NOT NULL,
  `value` varchar(191) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_contacts`
--

INSERT INTO `vendor_contacts` (`id`, `vendor_id`, `label`, `channel`, `value`, `is_primary`, `sort_order`, `created_at`, `updated_at`) VALUES
(20, 8, 'เบอร์โทรสำนักงาน', 'phone', '02-333-4444', 1, 1, '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(21, 9, 'เบอร์มือถือ', 'phone', '081-999-8888', 1, 1, '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(22, 10, 'Sales Email', 'email', 'sales@globaltech.com', 1, 1, '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(26, 8, 'เบอร์โทร', 'phone', '02-333-4444', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(27, 9, 'เบอร์มือถือ', 'phone', '081-999-8888', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(28, 10, 'Sales Email', 'email', 'sales@globaltech.com', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(29, 7, NULL, 'email', 'info@supplier-a.com', 1, 0, '2026-03-20 12:00:54', '2026-03-20 12:00:54'),
(30, 7, NULL, 'phone', '213131331213', 0, 1, '2026-03-20 12:00:54', '2026-03-20 12:00:54'),
(31, 7, NULL, 'website', 'www.supplier-a.com', 0, 2, '2026-03-20 12:00:54', '2026-03-20 12:00:54'),
(32, 7, NULL, 'fax', '02-111-2223', 0, 3, '2026-03-20 12:00:54', '2026-03-20 12:00:54');

-- --------------------------------------------------------

--
-- Table structure for table `vendor_people`
--

CREATE TABLE `vendor_people` (
  `id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `prefix` varchar(20) DEFAULT NULL,
  `first_name` varchar(70) NOT NULL,
  `last_name` varchar(70) DEFAULT NULL,
  `nickname` varchar(50) DEFAULT NULL,
  `email` varchar(191) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `position` varchar(80) DEFAULT NULL,
  `department` varchar(80) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_people`
--

INSERT INTO `vendor_people` (`id`, `vendor_id`, `prefix`, `first_name`, `last_name`, `nickname`, `email`, `phone`, `position`, `department`, `is_primary`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 4, 'นาง', 'dad', 'fasf', 'fdsfs', 'gdfsgdf', '321313', 'PRO', 'IE', 1, 0, '2026-02-09 16:54:56', '2026-02-09 16:54:56'),
(2, 5, 'คุณ', 'ข้อมูลผู้ติดต่อ', 'ข้อมูลผู้ติดต่อaaaaa', 'ข้อมูลผู้ติดต่อttttt', 'ข้อมูลผู้ติดต่อ@Hmai.com', '6888878887', 'IT', 'DEV', 1, 0, '2026-02-17 09:45:46', '2026-02-17 09:45:46'),
(3, 6, 'คุณ', 'QWERTY', 'QWERTY', 'QWERTY', 'QWERTY@Gmail.com', '7878787878', 'QWERTY', 'DEV', 1, 0, '2026-02-17 10:04:54', '2026-02-17 10:04:54'),
(6, 8, 'คุณ', 'สมหญิง', 'ใจดี', 'หญิง', 'somying@customer-b.com', '081-333-4444', 'หัวหน้าจัดซื้อ', 'จัดซื้อ', 1, 1, '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(7, 9, 'นาย', 'สมชาย', 'รักการค้า', 'ชาย', 'somchai@gmail.com', '081-999-8888', 'เจ้าของกิจการ', 'บริหาร', 1, 1, '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(8, 10, 'Mr.', 'John', 'Doe', 'John', 'john@globaltech.com', '+1-555-0198', 'Sales Director', 'Sales', 1, 1, '2026-03-20 11:57:48', '2026-03-20 11:57:48'),
(11, 8, 'คุณ', 'สมหญิง', 'ใจดี', 'หญิง', 'somying@customer-b.com', '081-333-4444', 'หัวหน้าจัดซื้อ', 'จัดซื้อ', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(12, 9, 'นาย', 'สมชาย', 'รักการค้า', 'ชาย', 'somchai@gmail.com', '081-999-8888', 'เจ้าของ', 'บริหาร', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(13, 10, 'Mr.', 'John', 'Doe', 'John', 'john@globaltech.com', '+1-555-0198', 'Sales Director', 'Sales', 1, 1, '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(14, 7, 'คุณ', 'สมปอง', 'ค้าขายดี', 'ปอง', 'sompong@supplier-a.com', '089-111-2222', 'ผู้จัดการฝ่ายขาย', 'ฝ่ายขาย', 1, 0, '2026-03-20 12:00:54', '2026-03-20 12:00:54');

-- --------------------------------------------------------

--
-- Table structure for table `vendor_shipping_addresses`
--

CREATE TABLE `vendor_shipping_addresses` (
  `id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `contact_name` varchar(100) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `address_line` text DEFAULT NULL,
  `subdistrict` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postcode` varchar(20) DEFAULT NULL,
  `country` varchar(60) DEFAULT 'TH',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `vendor_shipping_addresses`
--

INSERT INTO `vendor_shipping_addresses` (`id`, `vendor_id`, `contact_name`, `phone`, `address_line`, `subdistrict`, `district`, `province`, `postcode`, `country`, `created_at`, `updated_at`) VALUES
(1, 6, 'QWERTY', '090909090', 'QWERTY', 'QWERTY', 'QWERTY', 'QWERTY', '12345', 'TH', '2026-02-17 10:04:54', '2026-02-17 10:04:54'),
(3, 8, 'จุดรับสินค้า C', '081-333-4444', '88/9 หมู่ 5', 'บางโฉลง', 'บางพลี', 'สมุทรปราการ', '10540', 'TH', '2026-03-20 11:58:51', '2026-03-20 11:58:51'),
(4, 9, 'สโตร์ เฮียสมชาย', '081-999-8888', '789 ซอยลาดพร้าว 1', 'จอมพล', 'จตุจักร', 'กรุงเทพมหานคร', '10900', 'TH', '2026-03-20 11:58:51', '2026-03-20 11:58:51'),
(6, 8, 'จุดรับสินค้า C', '081-333-4444', '88/9 หมู่ 5', 'บางโฉลง', 'บางพลี', 'สมุทรปราการ', '10540', 'TH', '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(7, 9, 'สโตร์เฮียสมชาย', '081-999-8888', '789 ซอยลาดพร้าว 1', 'จอมพล', 'จตุจักร', 'กรุงเทพมหานคร', '10900', 'TH', '2026-03-20 12:00:22', '2026-03-20 12:00:22'),
(8, 7, 'คลังสินค้าย่อย A', '089-111-2222', '999 โกดัง A ซอยสุขุมวิท 50', 'พระโขนง', 'คลองเตย', 'กรุงเทพมหานคร', '10260', 'TH', '2026-03-20 12:00:54', '2026-03-20 12:00:54');

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouses`
--

INSERT INTO `warehouses` (`id`, `company_id`, `code`, `name`, `location`, `province`, `district`, `sub_district`, `zip_code`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
(3, 1, 'KC-001', 'Main', 'BKK', 'กรุงเทพมหานคร', 'เขตบางซื่อ', 'บางซื่อ', '10800', 'main', 1, '2026-03-20 12:04:47', '2026-03-20 12:04:47'),
(4, 1, 'KC-002', 'Twomain', 'Nonthaburi', 'กรุงเทพมหานคร', 'เขตบางซื่อ', 'บางซื่อ', '10800', 'twomain', 1, '2026-03-20 12:05:15', '2026-03-20 12:05:15');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `billing_notes`
--
ALTER TABLE `billing_notes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_billing_note_no` (`company_id`,`doc_no`),
  ADD KEY `fk_billing_note_customer` (`customer_id`);

--
-- Indexes for table `billing_note_items`
--
ALTER TABLE `billing_note_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_bn_item_sales` (`billing_note_id`,`sales_id`),
  ADD KEY `fk_bni_sales` (`sales_id`);

--
-- Indexes for table `commission_payments`
--
ALTER TABLE `commission_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `seller_id` (`seller_id`),
  ADD KEY `finance_account_id` (`finance_account_id`),
  ADD KEY `paid_by` (`paid_by`),
  ADD KEY `idx_cp_doc_no` (`document_no`);

--
-- Indexes for table `commission_payment_items`
--
ALTER TABLE `commission_payment_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `commission_payment_id` (`commission_payment_id`),
  ADD KEY `sale_id` (`sale_id`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `company_doc_configs`
--
ALTER TABLE `company_doc_configs`
  ADD PRIMARY KEY (`company_id`,`doc_type`),
  ADD KEY `idx_company` (`company_id`);

--
-- Indexes for table `company_doc_sequences`
--
ALTER TABLE `company_doc_sequences`
  ADD PRIMARY KEY (`company_id`,`doc_type`,`period_key`),
  ADD KEY `idx_company` (`company_id`);

--
-- Indexes for table `finance_accounts`
--
ALTER TABLE `finance_accounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `company_id` (`company_id`);

--
-- Indexes for table `finance_transactions`
--
ALTER TABLE `finance_transactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grn_company_no` (`company_id`,`grn_no`),
  ADD KEY `fk_grn_vendor` (`vendor_id`),
  ADD KEY `fk_grn_wh` (`warehouse_id`),
  ADD KEY `fk_grn_created_by` (`created_by`),
  ADD KEY `fk_grn_approved_by` (`approved_by`),
  ADD KEY `idx_grn_po` (`po_id`),
  ADD KEY `idx_grn_company_bill` (`company_id`,`bill_id`);

--
-- Indexes for table `goods_receipt_items`
--
ALTER TABLE `goods_receipt_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_grni_grn` (`goods_receipt_id`),
  ADD KEY `fk_grni_product` (`product_id`),
  ADD KEY `idx_grni_bill_item` (`bill_item_id`);

--
-- Indexes for table `invoice_sequences`
--
ALTER TABLE `invoice_sequences`
  ADD PRIMARY KEY (`company_id`,`ym`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_permissions_code` (`code`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_products_company_code` (`company_id`,`code`),
  ADD KEY `idx_products_company` (`company_id`);

--
-- Indexes for table `product_stock`
--
ALTER TABLE `product_stock`
  ADD PRIMARY KEY (`product_id`,`warehouse_id`),
  ADD KEY `idx_ps_company` (`company_id`),
  ADD KEY `fk_ps_warehouse` (`warehouse_id`);

--
-- Indexes for table `purchase_bills`
--
ALTER TABLE `purchase_bills`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_bill_company_billno` (`company_id`,`bill_no`),
  ADD UNIQUE KEY `uq_bill_company_taxinv` (`company_id`,`tax_invoice_no`),
  ADD UNIQUE KEY `uq_bill_company_bill_no` (`company_id`,`bill_no`),
  ADD UNIQUE KEY `uq_bill_company_tax_invoice_no` (`company_id`,`tax_invoice_no`),
  ADD KEY `idx_bill_company_po` (`company_id`,`po_id`),
  ADD KEY `idx_bill_company_vendor` (`company_id`,`vendor_id`);

--
-- Indexes for table `purchase_bill_items`
--
ALTER TABLE `purchase_bill_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pbi_bill` (`purchase_bill_id`),
  ADD KEY `idx_pbi_product` (`product_id`);

--
-- Indexes for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_po_company_no` (`company_id`,`po_no`),
  ADD KEY `idx_po_company` (`company_id`),
  ADD KEY `idx_po_vendor` (`company_id`,`vendor_id`),
  ADD KEY `idx_po_wh` (`company_id`,`warehouse_id`),
  ADD KEY `idx_po_status` (`company_id`,`status`),
  ADD KEY `idx_po_vendor_contact_id` (`vendor_person_id`),
  ADD KEY `idx_po_vendor_person_id` (`vendor_person_id`);

--
-- Indexes for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_poi_po` (`purchase_order_id`),
  ADD KEY `idx_poi_product` (`product_id`),
  ADD KEY `idx_poi_po_id` (`purchase_order_id`);

--
-- Indexes for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_refresh_token_hash` (`token_hash`),
  ADD KEY `idx_refresh_user` (`user_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_roles_company_code` (`company_id`,`code`),
  ADD KEY `idx_roles_company` (`company_id`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `fk_rp_perm` (`permission_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sales_company_no` (`company_id`,`invoice_no`),
  ADD UNIQUE KEY `uq_sales_company_invoice` (`company_id`,`invoice_no`),
  ADD KEY `fk_sales_seller` (`seller_id`),
  ADD KEY `fk_sales_wh` (`warehouse_id`),
  ADD KEY `fk_sales_created_by` (`created_by`),
  ADD KEY `fk_sales_approved_by` (`approved_by`),
  ADD KEY `idx_sales_company_status_issue` (`company_id`,`status`,`issue_date`),
  ADD KEY `idx_sales_company_seller_issue` (`company_id`,`seller_id`,`issue_date`),
  ADD KEY `fk_sales_commission_payment` (`commission_payment_id`);

--
-- Indexes for table `sales_items`
--
ALTER TABLE `sales_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_si_product` (`product_id`),
  ADD KEY `idx_sales_items_sales_id` (`sales_id`);

--
-- Indexes for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_adj_company_doc` (`company_id`,`doc_no`),
  ADD KEY `idx_adj_company` (`company_id`),
  ADD KEY `idx_adj_wh` (`company_id`,`warehouse_id`),
  ADD KEY `fk_adj_wh` (`warehouse_id`),
  ADD KEY `fk_adj_created_by` (`created_by`),
  ADD KEY `fk_adj_approved_by` (`approved_by`),
  ADD KEY `fk_adj_cancelled_by` (`cancelled_by`);

--
-- Indexes for table `stock_adjustment_items`
--
ALTER TABLE `stock_adjustment_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_adj_item_header` (`adjustment_id`),
  ADD KEY `idx_adj_item_product` (`product_id`);

--
-- Indexes for table `stock_counts`
--
ALTER TABLE `stock_counts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sc_no` (`company_id`,`doc_no`),
  ADD KEY `fk_sc_wh` (`warehouse_id`);

--
-- Indexes for table `stock_count_items`
--
ALTER TABLE `stock_count_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_sci_sc` (`count_id`),
  ADD KEY `fk_sci_prod` (`product_id`);

--
-- Indexes for table `stock_lots`
--
ALTER TABLE `stock_lots`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_lot_fifo` (`company_id`,`product_id`,`warehouse_id`,`received_date`,`id`),
  ADD KEY `fk_lot_product` (`product_id`),
  ADD KEY `fk_lot_wh` (`warehouse_id`);

--
-- Indexes for table `stock_lot_moves`
--
ALTER TABLE `stock_lot_moves`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_slm_ref` (`ref_type`,`ref_id`),
  ADD KEY `fk_slm_company` (`company_id`),
  ADD KEY `fk_slm_lot` (`lot_id`);

--
-- Indexes for table `stock_moves`
--
ALTER TABLE `stock_moves`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sm_ref` (`ref_type`,`ref_id`),
  ADD KEY `idx_sm_company` (`company_id`),
  ADD KEY `fk_sm_product` (`product_id`),
  ADD KEY `fk_sm_wh` (`warehouse_id`),
  ADD KEY `fk_sm_user` (`created_by`);

--
-- Indexes for table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tf_no` (`company_id`,`doc_no`),
  ADD KEY `fk_tf_src_wh` (`source_warehouse_id`),
  ADD KEY `fk_tf_tgt_wh` (`target_warehouse_id`);

--
-- Indexes for table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_tfi_tf` (`transfer_id`),
  ADD KEY `fk_tfi_prod` (`product_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD KEY `idx_users_company` (`company_id`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `fk_ur_role` (`role_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_vendor_company_code` (`company_id`,`code`);

--
-- Indexes for table `vendor_addresses`
--
ALTER TABLE `vendor_addresses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_vendor_addresses_vendor_type` (`vendor_id`,`addr_type`),
  ADD KEY `idx_vendor_addresses_vendor` (`vendor_id`);

--
-- Indexes for table `vendor_bank_accounts`
--
ALTER TABLE `vendor_bank_accounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_vendor_bank_vendor` (`vendor_id`);

--
-- Indexes for table `vendor_contacts`
--
ALTER TABLE `vendor_contacts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_vendor_contacts_vendor` (`vendor_id`);

--
-- Indexes for table `vendor_people`
--
ALTER TABLE `vendor_people`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_vendor_people_vendor` (`vendor_id`);

--
-- Indexes for table `vendor_shipping_addresses`
--
ALTER TABLE `vendor_shipping_addresses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_vendor_shipping_vendor` (`vendor_id`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_wh_company_code` (`company_id`,`code`),
  ADD KEY `idx_wh_company` (`company_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `billing_notes`
--
ALTER TABLE `billing_notes`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `billing_note_items`
--
ALTER TABLE `billing_note_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `commission_payments`
--
ALTER TABLE `commission_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `commission_payment_items`
--
ALTER TABLE `commission_payment_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `finance_accounts`
--
ALTER TABLE `finance_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `finance_transactions`
--
ALTER TABLE `finance_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `goods_receipt_items`
--
ALTER TABLE `goods_receipt_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `purchase_bills`
--
ALTER TABLE `purchase_bills`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `purchase_bill_items`
--
ALTER TABLE `purchase_bill_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `purchase_orders`
--
ALTER TABLE `purchase_orders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `sales_items`
--
ALTER TABLE `sales_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_adjustment_items`
--
ALTER TABLE `stock_adjustment_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_counts`
--
ALTER TABLE `stock_counts`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_count_items`
--
ALTER TABLE `stock_count_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_lots`
--
ALTER TABLE `stock_lots`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `stock_lot_moves`
--
ALTER TABLE `stock_lot_moves`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `stock_moves`
--
ALTER TABLE `stock_moves`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `vendor_addresses`
--
ALTER TABLE `vendor_addresses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `vendor_bank_accounts`
--
ALTER TABLE `vendor_bank_accounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `vendor_contacts`
--
ALTER TABLE `vendor_contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `vendor_people`
--
ALTER TABLE `vendor_people`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `vendor_shipping_addresses`
--
ALTER TABLE `vendor_shipping_addresses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `billing_notes`
--
ALTER TABLE `billing_notes`
  ADD CONSTRAINT `fk_bn_customer` FOREIGN KEY (`customer_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `billing_note_items`
--
ALTER TABLE `billing_note_items`
  ADD CONSTRAINT `fk_bni_bn` FOREIGN KEY (`billing_note_id`) REFERENCES `billing_notes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bni_sales` FOREIGN KEY (`sales_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `commission_payments`
--
ALTER TABLE `commission_payments`
  ADD CONSTRAINT `commission_payments_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `commission_payments_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `commission_payments_ibfk_3` FOREIGN KEY (`finance_account_id`) REFERENCES `finance_accounts` (`id`),
  ADD CONSTRAINT `commission_payments_ibfk_4` FOREIGN KEY (`paid_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `goods_receipts`
--
ALTER TABLE `goods_receipts`
  ADD CONSTRAINT `fk_grn_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_grn_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_grn_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_grn_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`),
  ADD CONSTRAINT `fk_grn_wh` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `goods_receipt_items`
--
ALTER TABLE `goods_receipt_items`
  ADD CONSTRAINT `fk_grni_grn` FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_grni_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `product_stock`
--
ALTER TABLE `product_stock`
  ADD CONSTRAINT `fk_ps_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ps_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ps_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchase_bill_items`
--
ALTER TABLE `purchase_bill_items`
  ADD CONSTRAINT `fk_pbi_bill` FOREIGN KEY (`purchase_bill_id`) REFERENCES `purchase_bills` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pbi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `purchase_order_items`
--
ALTER TABLE `purchase_order_items`
  ADD CONSTRAINT `fk_poi_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `fk_sales_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sales_commission_payment` FOREIGN KEY (`commission_payment_id`) REFERENCES `commission_payments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sales_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sales_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sales_seller` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sales_wh` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `sales_items`
--
ALTER TABLE `sales_items`
  ADD CONSTRAINT `fk_si_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_si_sales` FOREIGN KEY (`sales_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_adjustments`
--
ALTER TABLE `stock_adjustments`
  ADD CONSTRAINT `fk_adj_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_adj_cancelled_by` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_adj_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_adj_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_adj_wh` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_adjustment_items`
--
ALTER TABLE `stock_adjustment_items`
  ADD CONSTRAINT `fk_adj_item_header` FOREIGN KEY (`adjustment_id`) REFERENCES `stock_adjustments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_adj_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Constraints for table `stock_counts`
--
ALTER TABLE `stock_counts`
  ADD CONSTRAINT `fk_sc_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_count_items`
--
ALTER TABLE `stock_count_items`
  ADD CONSTRAINT `fk_sci_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_sci_parent` FOREIGN KEY (`count_id`) REFERENCES `stock_counts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_lots`
--
ALTER TABLE `stock_lots`
  ADD CONSTRAINT `fk_lot_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lot_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_lot_wh` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_lot_moves`
--
ALTER TABLE `stock_lot_moves`
  ADD CONSTRAINT `fk_slm_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_slm_lot` FOREIGN KEY (`lot_id`) REFERENCES `stock_lots` (`id`);

--
-- Constraints for table `stock_moves`
--
ALTER TABLE `stock_moves`
  ADD CONSTRAINT `fk_sm_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sm_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_sm_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_sm_wh` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_transfers`
--
ALTER TABLE `stock_transfers`
  ADD CONSTRAINT `fk_tf_src` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses` (`id`),
  ADD CONSTRAINT `fk_tf_tgt` FOREIGN KEY (`target_warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `stock_transfer_items`
--
ALTER TABLE `stock_transfer_items`
  ADD CONSTRAINT `fk_tfi_p` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_tfi_parent` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `vendors`
--
ALTER TABLE `vendors`
  ADD CONSTRAINT `fk_vendor_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `vendor_bank_accounts`
--
ALTER TABLE `vendor_bank_accounts`
  ADD CONSTRAINT `fk_vendor_bank_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `vendor_contacts`
--
ALTER TABLE `vendor_contacts`
  ADD CONSTRAINT `fk_vendor_contacts_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD CONSTRAINT `fk_wh_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
