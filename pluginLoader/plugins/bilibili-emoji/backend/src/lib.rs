/**
 * B站表情包插件后端 - Rust实现
 * 功能：
 * 1. 扫描本地表情包
 * 2. 搜索B站装扮
 * 3. 下载表情包装扮
 */

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

// ========== 数据结构定义 ==========

#[derive(Debug, Serialize, Deserialize)]
pub struct EmojiInfo {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub emoji_type: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub emojis: Vec<EmojiInfo>,
    pub count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub success: bool,
    pub suits: Vec<SuitInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SuitInfo {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub suit_type: String,
    pub lottery_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub count: usize,
    pub category: String,
    pub error: Option<String>,
}

// ========== B站API响应结构 ==========

#[derive(Debug, Deserialize)]
struct SearchResponse {
    code: i32,
    message: String,
    data: SearchData,
}

#[derive(Debug, Deserialize)]
struct SearchData {
    list: Vec<SearchListItem>,
}

#[derive(Debug, Deserialize)]
struct SearchListItem {
    item_id: i64,
    name: String,
    properties: SearchProperties,
}

#[derive(Debug, Deserialize)]
struct SearchProperties {
    #[serde(rename = "type")]
    suit_type: Option<String>,
    dlc_act_id: Option<String>,
    dlc_lottery_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SuitInfoResponse {
    code: i32,
    data: SuitData,
}

#[derive(Debug, Deserialize)]
struct SuitData {
    item: SuitItem,
    suit_items: std::collections::HashMap<String, Vec<SuitSubItem>>,
}

#[derive(Debug, Deserialize)]
struct SuitItem {
    name: String,
}

#[derive(Debug, Deserialize)]
struct SuitSubItem {
    name: String,
    properties: std::collections::HashMap<String, String>,
}

// ========== 核心功能实现 ==========

/// 扫描本地表情包
pub fn scan_emojis(emoji_dir: &Path) -> ScanResult {
    let mut emojis = Vec::new();

    if !emoji_dir.exists() {
        if let Err(e) = fs::create_dir_all(emoji_dir) {
            return ScanResult {
                success: false,
                emojis: vec![],
                count: 0,
                error: Some(format!("创建目录失败: {}", e)),
            };
        }
    }

    // 遍历表情包目录
    for entry in WalkDir::new(emoji_dir)
        .min_depth(1)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // 只处理图片文件
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if matches!(ext_str.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp") {
                    // 获取文件名（不含扩展名）
                    let name = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    // 获取分类（父目录名）
                    let category = path
                        .parent()
                        .and_then(|p| p.file_name())
                        .and_then(|s| s.to_str())
                        .unwrap_or("default")
                        .to_string();

                    // 判断类型
                    let emoji_type = if ext_str == "gif" { "gif" } else { "static" };

                    emojis.push(EmojiInfo {
                        name,
                        path: path.to_string_lossy().to_string(),
                        emoji_type: emoji_type.to_string(),
                        category,
                    });
                }
            }
        }
    }

    let count = emojis.len();
    ScanResult {
        success: true,
        emojis,
        count,
        error: None,
    }
}

/// 搜索B站装扮
pub async fn search_suits(keyword: &str) -> SearchResult {
    let url = format!(
        "https://api.bilibili.com/x/garb/v2/mall/home/search?key_word={}",
        urlencoding::encode(keyword)
    );

    match reqwest::get(&url).await {
        Ok(response) => match response.json::<SearchResponse>().await {
            Ok(data) => {
                if data.code != 0 {
                    return SearchResult {
                        success: false,
                        suits: vec![],
                        error: Some(format!("搜索失败: {}", data.message)),
                    };
                }

                let suits = data
                    .data
                    .list
                    .into_iter()
                    .map(|item| {
                        let (suit_type, lottery_id) = if item.item_id == 0 {
                            // 收藏集
                            let lottery_id = item
                                .properties
                                .dlc_lottery_id
                                .and_then(|s| s.parse().ok());
                            ("dlc".to_string(), lottery_id)
                        } else {
                            // 普通装扮
                            ("normal".to_string(), None)
                        };

                        let id = if item.item_id == 0 {
                            item.properties
                                .dlc_act_id
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(0)
                        } else {
                            item.item_id
                        };

                        SuitInfo {
                            id,
                            name: item.name,
                            suit_type,
                            lottery_id,
                        }
                    })
                    .collect();

                SearchResult {
                    success: true,
                    suits,
                    error: None,
                }
            }
            Err(e) => SearchResult {
                success: false,
                suits: vec![],
                error: Some(format!("解析响应失败: {}", e)),
            },
        },
        Err(e) => SearchResult {
            success: false,
            suits: vec![],
            error: Some(format!("网络请求失败: {}", e)),
        },
    }
}

/// 下载装扮
pub async fn download_suit(
    suit_id: i64,
    suit_type: &str,
    emoji_dir: &Path,
) -> DownloadResult {
    match suit_type {
        "normal" => download_normal_suit(suit_id, emoji_dir).await,
        "dlc" => DownloadResult {
            success: false,
            count: 0,
            category: String::new(),
            error: Some("DLC装扮下载暂未实现".to_string()),
        },
        _ => DownloadResult {
            success: false,
            count: 0,
            category: String::new(),
            error: Some("未知的装扮类型".to_string()),
        },
    }
}

/// 下载普通装扮
async fn download_normal_suit(suit_id: i64, emoji_dir: &Path) -> DownloadResult {
    let url = format!(
        "https://api.bilibili.com/x/garb/mall/item/suit/v2?part=suit&item_id={}",
        suit_id
    );

    let response = match reqwest::get(&url).await {
        Ok(r) => r,
        Err(e) => {
            return DownloadResult {
                success: false,
                count: 0,
                category: String::new(),
                error: Some(format!("网络请求失败: {}", e)),
            }
        }
    };

    let suit_info: SuitInfoResponse = match response.json().await {
        Ok(data) => data,
        Err(e) => {
            return DownloadResult {
                success: false,
                count: 0,
                category: String::new(),
                error: Some(format!("解析响应失败: {}", e)),
            }
        }
    };

    if suit_info.code != 0 {
        return DownloadResult {
            success: false,
            count: 0,
            category: String::new(),
            error: Some("获取装扮信息失败".to_string()),
        };
    }

    let suit_name = sanitize_filename(&suit_info.data.item.name);
    let suit_dir = emoji_dir.join(&suit_name);

    if let Err(e) = fs::create_dir_all(&suit_dir) {
        return DownloadResult {
            success: false,
            count: 0,
            category: suit_name,
            error: Some(format!("创建目录失败: {}", e)),
        };
    }

    let mut download_count = 0;
    let client = reqwest::Client::new();

    // 下载所有资源
    for (_category, items) in suit_info.data.suit_items {
        for item in items {
            for (key, url) in item.properties {
                if url.starts_with("https") {
                    let filename = format!(
                        "{}.{}.{}",
                        sanitize_filename(&item.name),
                        key,
                        get_extension(&url)
                    );
                    let file_path = suit_dir.join(&filename);

                    match download_file(&client, &url, &file_path).await {
                        Ok(_) => download_count += 1,
                        Err(e) => {
                            eprintln!("下载失败 {}: {}", filename, e);
                        }
                    }
                }
            }
        }
    }

    DownloadResult {
        success: true,
        count: download_count,
        category: suit_name,
        error: None,
    }
}

/// 下载单个文件
async fn download_file(
    client: &reqwest::Client,
    url: &str,
    path: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let response = client.get(url).send().await?;
    let bytes = response.bytes().await?;
    fs::write(path, bytes)?;
    Ok(())
}

/// 清理文件名中的非法字符
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}

/// 从URL获取文件扩展名
fn get_extension(url: &str) -> String {
    url.split('.')
        .last()
        .and_then(|s| s.split('?').next())
        .unwrap_or("png")
        .to_string()
}

// ========== 导出的C接口（用于动态库） ==========

#[no_mangle]
pub extern "C" fn plugin_init() {
    println!("[bilibili-emoji-backend] Plugin initialized");
}

#[no_mangle]
pub extern "C" fn plugin_cleanup() {
    println!("[bilibili-emoji-backend] Plugin cleaned up");
}
